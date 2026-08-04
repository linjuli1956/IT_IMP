/**
 * 删除单张发票 API
 * DELETE /api/invoices/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 * 同时删除物理PDF文件，并更新批次统计数据
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'
import { unlink } from 'fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的发票ID' })
  }

  // 查找发票记录
  const invoice = await prisma.invoice.findUnique({ where: { id } })
  if (!invoice) {
    throw createError({ statusCode: 404, message: '发票不存在或已删除' })
  }

  // 1. 删除物理PDF文件
  if (invoice.filePath) {
    const relPath = invoice.filePath.replace(/^\/files\//, '')
    const absPath = resolve(process.cwd(), '..', 'data', relPath)
    try {
      await unlink(absPath)
    } catch {
      // 文件可能已不存在，忽略错误
    }
  }

  // 2. 删除 DB 记录
  await prisma.invoice.delete({ where: { id } })

  // 3. 更新批次统计（invoiceCount、totalAmount）
  if (invoice.batchId) {
    const remaining = await prisma.invoice.findMany({
      where: { batchId: invoice.batchId },
      select: { amount: true },
    })
    await prisma.invoiceBatch.update({
      where: { id: invoice.batchId },
      data: {
        invoiceCount: remaining.length,
        totalAmount: remaining.reduce((sum, inv) => sum + Number(inv.amount), 0),
      },
    })
  }

  // 4. 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '发票管理',
      content: `删除发票「${invoice.name}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
