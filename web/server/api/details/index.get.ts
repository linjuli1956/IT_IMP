/**
 * 获取明细表列表 API
 * GET /api/details
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=中国电信&feeMonth=2026-06（可选筛选）
 * 成功返回: DetailTable[]，按 id 降序
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

/** 序列化明细表记录（Decimal → number, Date → string） */
function serializeDetail(d: any) {
  return {
    ...d,
    totalAmount: Number(d.totalAmount),
    uploadTime: formatDate(d.uploadTime),
    sheets: d.sheets,
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const carrier = query.carrier as string | undefined
  const feeMonth = query.feeMonth as string | undefined

  const where: Record<string, string> = {}
  if (carrier) where.carrier = carrier
  if (feeMonth) where.feeMonth = feeMonth

  const details = await prisma.detailTable.findMany({
    where,
    orderBy: { id: 'desc' },
  })

  return details.map(serializeDetail)
})
