/**
 * 获取电脑列表 API（分页）
 * GET /api/computers?page=&pageSize=&storeId=&status=&keyword=
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'
import { parsePagination } from '../../utils/server-dto'
import { serializeComputer } from '../../utils/computer-dto'
import { ASSET_STATUS_VALUES } from '../../utils/network-device-dto'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const query = getQuery(event)
  const { page, pageSize, skip } = parsePagination(query)

  const where: Record<string, unknown> = {}
  if (query.status) {
    const v = String(query.status)
    if (!ASSET_STATUS_VALUES.includes(v as never)) {
      throw createError({ statusCode: 400, message: `status 只允许 ${ASSET_STATUS_VALUES.join('/')}` })
    }
    where.status = v
  }
  if (query.storeId) where.storeId = parsePositiveSafeId(query.storeId, 'storeId')
  if (query.keyword) {
    const keyword = String(query.keyword)
    where.OR = [
      { brand: { contains: keyword } },
      { model: { contains: keyword } },
      { user: { contains: keyword } },
      { assetNo: { contains: keyword } },
      { ipAddress: { contains: keyword } },
    ]
  }

  const [list, total] = await Promise.all([
    prisma.computer.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.computer.count({ where }),
  ])

  return {
    list: list.map(c => serializeComputer(c)),
    total,
    page,
    pageSize,
  }
})
