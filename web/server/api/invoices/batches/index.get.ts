/**
 * 发票批次列表 API
 * GET /api/invoices/batches
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=中国电信&feeMonth=2026-06&status=pending（可选筛选）
 * 成功返回: Batch[]，按 id 降序
 */
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
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

/** 序列化批次记录（Decimal → number, Date → string） */
function serializeBatch(b: any) {
  return {
    ...b,
    totalAmount: Number(b.totalAmount),
    createTime: formatDate(b.createTime),
    invoices: b.invoices?.map((inv: any) => serializeInvoice(inv)) || [],
  }
}

/** 序列化发票记录（Decimal → number, Date → string） */
function serializeInvoice(inv: any) {
  return {
    ...inv,
    amount: Number(inv.amount),
    uploadTime: formatDate(inv.uploadTime),
    stores: inv.stores,
    ocrResult: inv.ocrResult,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    sellerName: inv.sellerName,
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

  const batches = await prisma.invoiceBatch.findMany({
    where,
    orderBy: { id: 'desc' },
    include: {
      invoices: {
        orderBy: { id: 'asc' },
      },
    },
  })

  return batches.map(serializeBatch)
})
