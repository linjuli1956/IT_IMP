/**
 * 新增网络设备 API
 * POST /api/network-devices
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 必填: storeId, deviceType
 * 校验: 白名单 + 严格枚举 + 可空唯一字段空串→NULL
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'
import { validateNetworkDeviceFields, mapDeviceApiError, formatDeviceName } from '../../utils/network-device-dto'
import type { Prisma } from '../../../generated/prisma/client'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody<Record<string, unknown>>(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validateNetworkDeviceFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }
  if (data.storeId === undefined) throw createError({ statusCode: 400, message: 'storeId 必填' })
  if (data.deviceType === undefined) throw createError({ statusCode: 400, message: 'deviceType 必填' })

  try {
    // 交互式事务：取得真实对象后写日志（门店名、设备名），日志失败整体回滚
    const device = await prisma.$transaction(async (tx) => {
      const created = await tx.networkDevice.create({
        data: data as Prisma.NetworkDeviceUncheckedCreateInput,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '新增',
          module: '网络设备',
          content: `新增网络设备「${formatDeviceName(created)}」（门店：${created.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return created
    })
    return device
  } catch (error: any) {
    const mapped = mapDeviceApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
