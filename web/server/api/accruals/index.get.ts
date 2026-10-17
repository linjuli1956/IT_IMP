/**
 * 计提表列表 API
 * GET /api/accruals
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=中国电信&feeMonth=2026-06&status=generated（可选筛选）
 * 成功返回: Accrual[]，按 id 降序
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

/** 序列化计提表记录（Decimal → number, Date → string, 附加批次费用月） */
function serializeAccrual(a: any, batchFeeMonth: string) {
  return {
    ...a,
    totalAmount: Number(a.totalAmount),
    createTime: formatDate(a.createTime),
    groups: a.groups,
    batchFeeMonth,
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const carrier = query.carrier as string | undefined
  const feeMonth = query.feeMonth as string | undefined
  const status = query.status as string | undefined

  const where: Record<string, string> = {}
  if (carrier) where.carrier = carrier
  if (feeMonth) where.feeMonth = feeMonth
  if (status) where.status = status

  const accruals = await prisma.accrual.findMany({
    where,
    orderBy: { id: 'desc' },
  })

  // 批次费用月（发票费用月）：Accrual 与 InvoiceBatch 无关联，按 batchId 批量查询
  const batchIds = [...new Set(accruals.map(a => a.batchId))]
  const batches = batchIds.length > 0
    ? await prisma.invoiceBatch.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, feeMonth: true },
      })
    : []
  const feeMonthMap = new Map(batches.map(b => [b.id, b.feeMonth]))

  return accruals.map(a => serializeAccrual(a, feeMonthMap.get(a.batchId) ?? ''))
})
