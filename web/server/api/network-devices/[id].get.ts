/**
 * 网络设备详情 API
 * GET /api/network-devices/:id
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 返回: 详情（含 storeName）
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const device = await prisma.networkDevice.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true } } },
  })
  if (!device) {
    throw createError({ statusCode: 404, message: '网络设备不存在' })
  }

  return { ...device, storeName: device.store?.name ?? null, store: undefined }
})
