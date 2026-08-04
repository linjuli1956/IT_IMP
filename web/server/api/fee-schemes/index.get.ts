/**
 * 获取费用分摊方案列表 API
 * GET /api/fee-schemes
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=中国联通&status=1（可选筛选）
 * 成功返回: FeeAllocationScheme[]，按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 序列化方案记录（Date → string） */
function serializeScheme(s: any) {
  return {
    ...s,
    updateTime: formatDate(s.updateTime),
    items: s.items,
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const carrier = query.carrier as string | undefined
  const status = query.status as string | undefined

  const where: Record<string, any> = {}
  if (carrier) where.carrier = carrier
  if (status !== undefined) where.status = Number(status)

  const schemes = await prisma.feeAllocationScheme.findMany({
    where,
    orderBy: { id: 'asc' },
  })

  return schemes.map(serializeScheme)
})
