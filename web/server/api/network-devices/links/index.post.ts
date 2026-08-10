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
 * 3. 设备锁拿到后，existingLinks 也使用 SELECT ... FOR UPDATE 锁定读（current read），
 *    直接读取最新已提交数据（非事务快照），先到事务提交的连线立即可见 → 409 拒绝；
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
        // 1. 锁定两端设备（FOR UPDATE = 锁定读/当前读，读取最新已提交数据并加行锁）
        //    按 min(id)/max(id) 一致顺序加锁，A→B 和 B→A 请求锁同一对设备行
        const [firstId, secondId] = sourceDeviceId < targetDeviceId
          ? [sourceDeviceId, targetDeviceId]
          : [targetDeviceId, sourceDeviceId]

        // 严格串行获取锁：先锁较小 ID，再锁较大 ID，保证 A→B 和 B→A 加锁顺序一致
        const firstRows = await tx.$queryRaw`SELECT id, storeId, brand, model, deviceType FROM network_devices WHERE id = ${firstId} FOR UPDATE` as any[]
        const secondRows = await tx.$queryRaw`SELECT id, storeId, brand, model, deviceType FROM network_devices WHERE id = ${secondId} FOR UPDATE` as any[]

        // 校验设备锁查询确实各返回一行；并发删除导致缺行时返回明确 404，不依赖后续 P2003
        if (firstRows.length === 0) {
          throw createError({
            statusCode: 404,
            message: firstId === sourceDeviceId ? '源设备不存在' : '目标设备不存在',
          })
        }
        if (secondRows.length === 0) {
          throw createError({
            statusCode: 404,
            message: secondId === sourceDeviceId ? '源设备不存在' : '目标设备不存在',
          })
        }

        // 映射回 source/target
        const sourceDevice = firstId === sourceDeviceId ? firstRows[0] : secondRows[0]
        const targetDevice = firstId === targetDeviceId ? firstRows[0] : secondRows[0]

        // 第一版两端设备必须属于同一门店
        if (Number(sourceDevice.storeId) !== Number(targetDevice.storeId)) {
          const [sourceStore, targetStore] = await Promise.all([
            tx.store.findUnique({ where: { id: Number(sourceDevice.storeId) }, select: { name: true } }),
            tx.store.findUnique({ where: { id: Number(targetDevice.storeId) }, select: { name: true } }),
          ])
          throw createError({
            statusCode: 400,
            message: `第一版要求两端设备属于同一门店（源：${sourceStore?.name ?? '未知'}，目标：${targetStore?.name ?? '未知'}）`,
          })
        }

        // 2. 锁定读已存在的同方向 + 反方向连线
        //    FOR UPDATE = 锁定读/当前读，直接读取最新已提交数据（非事务快照）
        //    先到事务提交的连线此时立即可见 → 后到事务检测到反方向重复 → 409 拒绝
        const existingLinksRaw = await tx.$queryRaw`
          SELECT sourceDeviceId, targetDeviceId, sourcePort, targetPort
          FROM network_device_links
          WHERE (sourceDeviceId = ${sourceDeviceId} AND targetDeviceId = ${targetDeviceId})
             OR (sourceDeviceId = ${targetDeviceId} AND targetDeviceId = ${sourceDeviceId})
          FOR UPDATE
        `

        const existingLinks = (existingLinksRaw as any[]).map((r) => ({
          sourceDeviceId: Number(r.sourceDeviceId),
          targetDeviceId: Number(r.targetDeviceId),
          sourcePort: String(r.sourcePort ?? ''),
          targetPort: String(r.targetPort ?? ''),
        }))

        // 3. 同方向重复检查（含端口）
        const sameDirErr = checkSameDirectionDuplicate(
          existingLinks, sourceDeviceId, targetDeviceId, sourcePort, targetPort,
        )
        if (sameDirErr) {
          throw createError({ statusCode: 409, message: sameDirErr })
        }

        // 4. 反方向重复检查
        const reverseErr = checkReverseDuplicate(existingLinks, sourceDeviceId, targetDeviceId)
        if (reverseErr) {
          throw createError({ statusCode: 409, message: reverseErr })
        }

        // 5. 创建连接 + 写操作日志（同一事务）
        const sourceName = formatDeviceName({
          brand: sourceDevice.brand, model: sourceDevice.model, deviceType: sourceDevice.deviceType,
        })
        const targetName = formatDeviceName({
          brand: targetDevice.brand, model: targetDevice.model, deviceType: targetDevice.deviceType,
        })

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
