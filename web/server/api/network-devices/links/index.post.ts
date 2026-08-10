/**
 * 新建网络设备连接关系 API
 * POST /api/network-devices/links
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { sourceDeviceId, targetDeviceId, sourcePort, targetPort, linkType, remark }
 *
 * 并发安全设计（P1-1）：
 * A→B 与 B→A 并发请求时，通过以下机制保证不会同时成功：
 * 1. 全部校验和写入在单个 $transaction 内完成（无事务外检查窗口）；
 * 2. 事务内对两端设备行执行 SELECT ... FOR UPDATE，按 min(id)/max(id) 一致顺序加锁；
 *    A→B 和 B→A 请求锁同一对设备行，后到的事务等待先到的提交后才能继续；
 * 3. 先到事务提交后，后到事务重查 existingLinks 即可发现已存在连线 → 409 拒绝；
 * 4. 同方向唯一索引 unique_device_link 作为最后防线；
 * 5. 死锁/锁超时/序列化冲突 → isRetryableConcurrencyError → 最多重试 3 次。
 *
 * 可复现验证：
 *   并发两个请求 {sourceDeviceId:1, targetDeviceId:2} 和 {sourceDeviceId:2, targetDeviceId:1}。
 *   预期：一个 201 成功，另一个 409（反方向重复）。
 *   原理：两者 FOR UPDATE 锁同一对设备行（min=1,max=2），序列化执行。
 */
import { prisma } from '../../../utils/prisma'
import { requireRole, getClientIp } from '../../../utils/auth'
import { readBody, type H3Event } from 'h3'
import {
  validateLinkBody,
  validateNetworkLinkFields,
  checkSelfConnection,
  checkReverseDuplicate,
  checkSameDirectionDuplicate,
  mapLinkApiError,
  isRetryableConcurrencyError,
} from '../../../utils/network-link-dto'
import { formatDeviceName } from '../../../utils/network-device-dto'

/** 并发冲突最大重试次数 */
const MAX_RETRIES = 3

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const rawBody = await readBody(event)

  // —— 入口守卫：body 必须是普通 JSON 对象 ——
  const bodyCheck = validateLinkBody(rawBody)
  if (!bodyCheck.ok) {
    throw createError({ statusCode: 400, message: bodyCheck.error })
  }

  // —— 字段白名单 + 严格类型校验 ——
  const { data, errors } = validateNetworkLinkFields(bodyCheck.body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  // —— 必填校验 ——
  if (data.sourceDeviceId === undefined || data.targetDeviceId === undefined) {
    throw createError({ statusCode: 400, message: 'sourceDeviceId 和 targetDeviceId 为必填' })
  }

  const sourceDeviceId = data.sourceDeviceId as number
  const targetDeviceId = data.targetDeviceId as number
  const sourcePort = (data.sourcePort as string) ?? ''
  const targetPort = (data.targetPort as string) ?? ''
  const linkType = (data.linkType as string) ?? '直连'
  const remark = (data.remark as string) ?? ''

  // —— 禁止自连接（纯函数，无需事务） ——
  const selfErr = checkSelfConnection(sourceDeviceId, targetDeviceId)
  if (selfErr) {
    throw createError({ statusCode: 400, message: selfErr })
  }

  // —— 并发安全事务：锁定设备对 → 全部校验 → 创建 + 日志 ——
  let lastError: unknown

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. 查询 source/target 设备（含门店名）
        const [sourceDevice, targetDevice] = await Promise.all([
          tx.networkDevice.findUnique({
            where: { id: sourceDeviceId },
            include: { store: { select: { name: true } } },
          }),
          tx.networkDevice.findUnique({
            where: { id: targetDeviceId },
            include: { store: { select: { name: true } } },
          }),
        ])

        if (!sourceDevice) {
          throw createError({ statusCode: 404, message: '源设备不存在' })
        }
        if (!targetDevice) {
          throw createError({ statusCode: 404, message: '目标设备不存在' })
        }

        // 第一版两端设备必须属于同一门店
        if (sourceDevice.storeId !== targetDevice.storeId) {
          throw createError({
            statusCode: 400,
            message: `第一版要求两端设备属于同一门店（源：${sourceDevice.store?.name ?? '未知'}，目标：${targetDevice.store?.name ?? '未知'}）`,
          })
        }

        // 2. 锁定设备对（按 min/max 一致顺序，防止 A→B 和 B→A 并发通过）
        //    FOR UPDATE 使后到事务等待先到事务提交，提交后重查即可发现已存在连线
        const [firstId, secondId] = sourceDeviceId < targetDeviceId
          ? [sourceDeviceId, targetDeviceId]
          : [targetDeviceId, sourceDeviceId]
        await tx.$queryRaw`SELECT id FROM network_devices WHERE id = ${firstId} FOR UPDATE`
        await tx.$queryRaw`SELECT id FROM network_devices WHERE id = ${secondId} FOR UPDATE`

        // 3. 查询已存在的同方向 + 反方向连线（此时已持有行锁）
        const existingLinks = await tx.networkDeviceLink.findMany({
          where: {
            OR: [
              { sourceDeviceId, targetDeviceId },
              { sourceDeviceId: targetDeviceId, targetDeviceId: sourceDeviceId },
            ],
          },
        })

        // 4. 同方向重复检查（含端口）
        const sameDirErr = checkSameDirectionDuplicate(
          existingLinks, sourceDeviceId, targetDeviceId, sourcePort, targetPort,
        )
        if (sameDirErr) {
          throw createError({ statusCode: 409, message: sameDirErr })
        }

        // 5. 反方向重复检查
        const reverseErr = checkReverseDuplicate(existingLinks, sourceDeviceId, targetDeviceId)
        if (reverseErr) {
          throw createError({ statusCode: 409, message: reverseErr })
        }

        // 6. 创建连接 + 写操作日志（同一事务）
        const sourceName = formatDeviceName(sourceDevice)
        const targetName = formatDeviceName(targetDevice)

        await tx.networkDeviceLink.create({
          data: { sourceDeviceId, sourcePort, targetDeviceId, targetPort, linkType, remark },
        })
        await tx.operationLog.create({
          data: {
            userId: user.userId,
            username: user.username,
            action: '新增',
            module: '网络设备',
            content: `新建连接「${sourceName}」→「${targetName}」（${linkType}）`,
            ip: getClientIp(event),
          },
        })
      })

      return { success: true }
    } catch (error: any) {
      lastError = error
      // createError 抛出的 H3Error（已有 statusCode）直接重新抛出
      if (error.statusCode) throw error
      // 可重试的并发冲突：重试
      if (isRetryableConcurrencyError(error) && attempt < MAX_RETRIES - 1) {
        continue
      }
      // Prisma 错误映射
      const mapped = mapLinkApiError(error)
      if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
      throw error
    }
  }

  throw lastError
})
