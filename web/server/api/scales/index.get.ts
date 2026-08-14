/**
 * 获取电子称列表 API（分页）
 * GET /api/scales?page=&pageSize=&storeId=&status=&keyword=&calibration=
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'
import { parsePagination } from '../../utils/server-dto'
import { serializeScale } from '../../utils/scale-dto'
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
  // 校准状态筛选：仅 status=正常 参与，自然日边界（today 0 点 / +90 天）
  if (query.calibration) {
    const v = String(query.calibration)
    if (v !== 'overdue' && v !== 'soon' && v !== 'ok') {
      throw createError({ statusCode: 400, message: 'calibration 只允许 overdue/soon/ok' })
    }
    // status 与 calibration 冲突时返回 400（不允许静默覆盖）
    if (query.status && String(query.status) !== '正常') {
      throw createError({ statusCode: 400, message: 'calibration 与 status 冲突：校准筛选仅适用于 status=正常' })
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const plus90 = new Date(today)
    plus90.setDate(plus90.getDate() + 90)
    where.status = '正常'
    if (v === 'overdue') {
      where.nextCalibrationDate = { not: null, lte: today }
    } else if (v === 'soon') {
      where.nextCalibrationDate = { gt: today, lte: plus90 }
    } else {
      where.nextCalibrationDate = { gt: plus90 }
    }
  }
  if (query.storeId) where.storeId = parsePositiveSafeId(query.storeId, 'storeId')
  if (query.keyword) {
    const keyword = String(query.keyword)
    where.OR = [
      { brand: { contains: keyword } },
      { model: { contains: keyword } },
      { assetNo: { contains: keyword } },
      { scaleNo: { contains: keyword } },
      { ipAddress: { contains: keyword } },
      { installLocation: { contains: keyword } },
    ]
  }

  const [list, total] = await Promise.all([
    prisma.scale.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
      include: { store: { select: { id: true, name: true } } },
    }),
    prisma.scale.count({ where }),
  ])

  return {
    list: list.map(c => serializeScale(c)),
    total,
    page,
    pageSize,
  }
})