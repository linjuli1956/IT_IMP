/**
 * 删除网络设备连接关系 API
 * DELETE /api/network-devices/links/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 */
import { prisma } from '../../../utils/prisma'
import { parsePositiveSafeId } from '../../../utils/request-validation'
import { requireRole, getClientIp } from '../../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { mapLinkApiError } from '../../../utils/network-link-dto'
import { formatDeviceName } from '../../../utils/network-device-dto'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'), '连接ID')

  try {
    // 交互式事务：先查连接（含设备名），再删除，写日志，失败整体回滚
    await prisma.$transaction(async (tx) => {
      const link = await tx.networkDeviceLink.findUnique({
        where: { id },
        include: {
          sourceDevice: { select: { brand: true, model: true, deviceType: true } },
          targetDevice: { select: { brand: true, model: true, deviceType: true } },
        },
      })

      if (!link) {
        throw createError({ statusCode: 404, message: '连接关系不存在' })
      }

      await tx.networkDeviceLink.delete({ where: { id } })

      const sourceName = formatDeviceName(link.sourceDevice)
      const targetName = formatDeviceName(link.targetDevice)
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '删除',
          module: '网络设备',
          content: `删除连接「${sourceName}」→「${targetName}」（${link.linkType}）`,
          ip: getClientIp(event),
        },
      })
    })

    return { success: true }
  } catch (error: any) {
    if (error.statusCode) throw error
    const mapped = mapLinkApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
