/**
 * 获取网络设备列表 API（分页）
 * GET /api/network-devices?page=&pageSize=&deviceType=&storeId=&status=&keyword=
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 返回: { list, total, page, pageSize }；list 含 storeName（联表门店）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'
import { parsePagination } from '../../utils/server-dto'
import { NETWORK_DEVICE_TYPES, ASSET_STATUS_VALUES } from '../../utils/network-device-dto'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const { page, pageSize, skip } = parsePagination(query)

  const where: Record<string, unknown> = {}
  // 严格校验筛选参数（非法 → 400，不静默忽略）
  if (query.deviceType) {
    const v = String(query.deviceType)
    if (!NETWORK_DEVICE_TYPES.includes(v as never)) {
      throw createError({ statusCode: 400, message: `deviceType 只允许 ${NETWORK_DEVICE_TYPES.join('/')}` })
    }
    where.deviceType = v
  }
  if (query.status) {
    const v = String(query.status)
    if (!ASSET_STATUS_VALUES.includes(v as never)) {
      throw createError({ statusCode: 400, message: `status 只允许 ${ASSET_STATUS_VALUES.join('/')}` })
    }
    where.status = v
  }
  if (query.storeId) {
    const storeId = Number(query.storeId)
    if (!Number.isInteger(storeId) || storeId < 1) {
      throw createError({ statusCode: 400, message: 'storeId 必须是不小于 1 的整数' })
    }
    where.storeId = storeId
  }
  if (query.keyword) {
    const keyword = String(query.keyword)
    where.OR = [
      { brand: { contains: keyword } },
      { model: { contains: keyword } },
      { managementIp: { contains: keyword } },
      { installLocation: { contains: keyword } },
    ]
  }

  const [list, total] = await Promise.all([
    prisma.networkDevice.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.networkDevice.count({ where }),
  ])

  return {
    list: list.map(d => ({ ...d, storeName: d.store?.name ?? null, store: undefined })),
    total,
    page,
    pageSize,
  }
})
