/**
 * 发票列表 API
 * GET /api/invoices
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=&feeMonth=&store=&batchId=（可选筛选）
 * 成功返回: Invoice[]，按 id 降序
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
  const store = query.store as string | undefined
  const batchId = query.batchId as string | undefined

  const where: Record<string, any> = {}
  if (carrier) where.carrier = carrier
  if (feeMonth) where.feeMonth = feeMonth
  if (batchId) where.batchId = Number(batchId)

  // 门店筛选：stores 是 JSON 数组，需要用 JSON 查询
  // Prisma 对 MySQL JSON 查询支持有限，这里用 path 过滤
  let invoices = await prisma.invoice.findMany({
    where,
    orderBy: { id: 'desc' },
  })

  // 门店筛选在应用层处理（MySQL JSON 包含查询）
  if (store) {
    invoices = invoices.filter(inv => {
      const stores = inv.stores as string[]
      return Array.isArray(stores) && stores.includes(store)
    })
  }

  return invoices.map(serializeInvoice)
})
