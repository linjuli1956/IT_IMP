/**
 * 服务器统计 API（全量，不受列表分页/筛选影响）
 * GET /api/servers/stats
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 口径: 仅统计 status=正常 的资产（与需求文档 §9 提醒规则一致）；
 *       expireDate ≤ 今日+30 天（含已过期）计入 expiringSoonCount；
 *       warrantyEndDate ≤ 今日+90 天（含已过期）计入 warrantyExpiringCount。
 * 返回: { physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount }
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { buildServerStatsQueries } from '../../utils/server-stats'

export default defineEventHandler(async (event) => {
  requireRole(event)

  const q = buildServerStatsQueries()
  const [physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount] = await Promise.all([
    prisma.server.count({ where: q.physical }),
    prisma.server.count({ where: q.virtual }),
    prisma.server.count({ where: q.expiringSoon }),
    prisma.server.count({ where: q.warranty }),
  ])

  return { physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount }
})
