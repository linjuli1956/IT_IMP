/**
 * 编辑网络设备 API
 * PUT /api/network-devices/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 校验: 白名单 + 严格枚举 + 可空唯一字段空串→NULL
 * 错误: 唯一字段重复（P2002）→ 409
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'
import { validateNetworkDeviceFields, mapDeviceApiError, formatDeviceName } from '../../utils/network-device-dto'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validateNetworkDeviceFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  try {
    // 交互式事务：更新后取真实对象写日志（编辑局部 payload 也能得到完整设备名），日志失败整体回滚
    const device = await prisma.$transaction(async (tx) => {
      const updated = await tx.networkDevice.update({
        where: { id },
        data,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '编辑',
          module: '网络设备',
          content: `编辑网络设备「${formatDeviceName(updated)}」（门店：${updated.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return updated
    })
    return device
  } catch (error: any) {
    const mapped = mapDeviceApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
