/**
 * 获取固话列表 API（分页）
 * GET /api/phones?page=&pageSize=&storeId=&carrier=&status=&keyword=
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 返回: { list, total, page, pageSize }；list 含 storeName
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'
import { parsePagination } from '../../utils/server-dto'
import { PHONE_CARRIERS, serializePhone } from '../../utils/phone-dto'
import { ASSET_STATUS_VALUES } from '../../utils/network-device-dto'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const { page, pageSize, skip } = parsePagination(query)

  const where: Record<string, unknown> = {}
  if (query.carrier) {
    const v = String(query.carrier)
    if (!PHONE_CARRIERS.includes(v as never)) {
      throw createError({ statusCode: 400, message: `carrier 只允许 ${PHONE_CARRIERS.join('/')}` })
    }
    where.carrier = v
  }
  if (query.status) {
    const v = String(query.status)
    if (!ASSET_STATUS_VALUES.includes(v as never)) {
      throw createError({ statusCode: 400, message: `status 只允许 ${ASSET_STATUS_VALUES.join('/')}` })
    }
    where.status = v
  }
  if (query.storeId) {
    const storeId = parsePositiveSafeId(query.storeId, 'storeId')
    where.storeId = storeId
  }
  if (query.keyword) {
    const keyword = String(query.keyword)
    where.OR = [
      { phoneNumber: { contains: keyword } },
      { user: { contains: keyword } },
      { department: { contains: keyword } },
    ]
  }

  const [list, total] = await Promise.all([
    prisma.phone.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.phone.count({ where }),
  ])

  return {
    list: list.map(p => serializePhone(p)),
    total,
    page,
    pageSize,
  }
})
