/**
 * 新建网络设备连接关系 API
 * POST /api/network-devices/links
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { sourceDeviceId, targetDeviceId, sourcePort, targetPort, linkType, remark }
 * 校验：source/target 存在、禁止自连接、同门店、同方向+反方向禁止重复、linkType 枚举
 */
import { prisma } from '../../../utils/prisma'
import { requireRole, getClientIp } from '../../../utils/auth'
import { readBody, type H3Event } from 'h3'
import {
  validateNetworkLinkFields,
  checkSelfConnection,
  checkReverseDuplicate,
  checkSameDirectionDuplicate,
  mapLinkApiError,
} from '../../../utils/network-link-dto'
import { formatDeviceName } from '../../../utils/network-device-dto'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)

  // 1. 字段白名单校验
  const { data, errors } = validateNetworkLinkFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  // 必填校验
  if (data.sourceDeviceId === undefined || data.targetDeviceId === undefined) {
    throw createError({ statusCode: 400, message: 'sourceDeviceId 和 targetDeviceId 为必填' })
  }

  const sourceDeviceId = data.sourceDeviceId as number
  const targetDeviceId = data.targetDeviceId as number
  const sourcePort = (data.sourcePort as string) ?? ''
  const targetPort = (data.targetPort as string) ?? ''
  const linkType = (data.linkType as string) ?? '直连'
  const remark = (data.remark as string) ?? ''

  // 2. 禁止自连接（纯函数）
  const selfErr = checkSelfConnection(sourceDeviceId, targetDeviceId)
  if (selfErr) {
    throw createError({ statusCode: 400, message: selfErr })
  }

  try {
    // 3. 检查 source/target 设备是否存在 + 同门店
    const [sourceDevice, targetDevice] = await Promise.all([
      prisma.networkDevice.findUnique({ where: { id: sourceDeviceId }, include: { store: { select: { name: true } } } }),
      prisma.networkDevice.findUnique({ where: { id: targetDeviceId }, include: { store: { select: { name: true } } } }),
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

    // 4. 检查同方向 + 反方向重复
    const existingLinks = await prisma.networkDeviceLink.findMany({
      where: {
        OR: [
          { sourceDeviceId, targetDeviceId },
          { sourceDeviceId: targetDeviceId, targetDeviceId: sourceDeviceId },
        ],
      },
    })

    const sameDirErr = checkSameDirectionDuplicate(
      existingLinks, sourceDeviceId, targetDeviceId, sourcePort, targetPort,
    )
    if (sameDirErr) {
      throw createError({ statusCode: 409, message: sameDirErr })
    }

    const reverseErr = checkReverseDuplicate(existingLinks, sourceDeviceId, targetDeviceId)
    if (reverseErr) {
      throw createError({ statusCode: 409, message: reverseErr })
    }

    // 5. 创建连接 + 写操作日志（同一事务）
    const sourceName = formatDeviceName(sourceDevice)
    const targetName = formatDeviceName(targetDevice)

    await prisma.$transaction(async (tx) => {
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
    // createError 抛出的 H3Error 直接重新抛出
    if (error.statusCode) throw error
    // Prisma 错误映射
    const mapped = mapLinkApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
