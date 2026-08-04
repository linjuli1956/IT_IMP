/**
 * 发票批次详情 API
 * GET /api/invoices/batches/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Batch（含 invoices 发票列表）
 */
import { prisma } from '../../../utils/prisma'
import { requireRole } from '../../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 序列化发票记录 */
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

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的批次ID' })
  }

  const batch = await prisma.invoiceBatch.findUnique({
    where: { id },
    include: {
      invoices: {
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!batch) {
    throw createError({ statusCode: 404, message: '批次不存在或已删除' })
  }

  return {
    ...batch,
    totalAmount: Number(batch.totalAmount),
    createTime: formatDate(batch.createTime),
    invoices: batch.invoices.map(serializeInvoice),
  }
})
