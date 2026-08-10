/**
 * 删除网络设备 API
 * DELETE /api/network-devices/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { formatDeviceName } from '../../utils/network-device-dto'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  try {
    // 交互式事务：删除后取真实对象写日志（完整设备名），日志失败整体回滚
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.networkDevice.delete({ where: { id } })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '删除',
          module: '网络设备',
          content: `删除网络设备「${formatDeviceName(deleted)}」`,
          ip: getClientIp(event),
        },
      })
    })
    return { success: true }
  } catch (error: any) {
    const mapped = mapDeviceApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
