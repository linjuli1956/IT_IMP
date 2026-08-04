/**
 * 发票 OCR 确认 API
 * POST /api/invoices/confirm
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { invoices: [{ id, invoiceNumber, invoiceDate, sellerName, amount, stores }] }
 * 成功返回: { batch: Batch }
 *
 * 逻辑：
 * - 遍历 invoices 数组，逐条 update Invoice
 * - 设 status: 'ocr-confirmed'
 * - 更新批次统计（totalAmount, invoiceCount）
 * - 操作日志：action: '编辑', module: '发票管理'
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { createError, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  const body = await readBody(event)
  const invoices = body?.invoices

  if (!Array.isArray(invoices) || invoices.length === 0) {
    throw createError({ statusCode: 400, message: '缺少发票确认数据' })
  }

  // 遍历确认每张发票
  let batchId: number | null = null
  let batchNo = ''

  for (const item of invoices) {
    const id = Number(item.id)
    if (!id || isNaN(id)) {
      throw createError({ statusCode: 400, message: '无效的发票ID' })
    }

    const invoiceNumber = String(item.invoiceNumber || '')
    const invoiceDate = String(item.invoiceDate || '')
    const sellerName = String(item.sellerName || '')
    const amount = Number(item.amount) || 0
    const stores = Array.isArray(item.stores) ? item.stores : []

    // 更新发票记录
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber,
        invoiceDate,
        sellerName,
        amount,
        stores: stores as any,
        status: 'ocr-confirmed',
      },
    })

    // 记录批次ID（用于后续更新批次统计）
    if (updated.batchId && !batchId) {
      batchId = updated.batchId
      const batch = await prisma.invoiceBatch.findUnique({ where: { id: batchId } })
      if (batch) batchNo = batch.batchNo
    }
  }

  // 更新批次统计
  if (batchId) {
    const allInvoices = await prisma.invoice.findMany({
      where: { batchId },
      select: { amount: true },
    })
    await prisma.invoiceBatch.update({
      where: { id: batchId },
      data: {
        invoiceCount: allInvoices.length,
        totalAmount: allInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0),
      },
    })

    // 记录操作日志
    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '编辑',
        module: '发票管理',
        content: `确认OCR结果「${batchNo}」(${invoices.length}张)`,
        ip: getClientIp(event),
      },
    })

    const batch = await prisma.invoiceBatch.findUnique({ where: { id: batchId } })
    if (batch) {
      return {
        batch: {
          ...batch,
          totalAmount: Number(batch.totalAmount),
          createTime: formatDate(batch.createTime),
        },
      }
    }
  }

  return { batch: null }
})
