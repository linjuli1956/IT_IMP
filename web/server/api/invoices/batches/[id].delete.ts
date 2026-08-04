/**
 * 删除发票批次 API
 * DELETE /api/invoices/batches/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 * 级联删除：批次下所有发票记录 + 物理PDF文件
 */
import { prisma } from '../../../utils/prisma'
import { requireRole, getClientIp } from '../../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'
import { unlink, readdir, rmdir } from 'fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的批次ID' })
  }

  // 查找批次（含发票列表，用于删除文件和日志）
  const batch = await prisma.invoiceBatch.findUnique({
    where: { id },
    include: { invoices: true },
  })

  if (!batch) {
    throw createError({ statusCode: 404, message: '批次不存在或已删除' })
  }

  // 1. 删除所有发票关联的物理PDF文件
  for (const invoice of batch.invoices) {
    if (invoice.filePath) {
      // filePath 存的是 web 路径如 /files/uploads/invoices/{batchNo}/{filename}
      // 需要转换为磁盘路径
      const relPath = invoice.filePath.replace(/^\/files\//, '')
      const absPath = resolve(process.cwd(), '..', 'data', relPath)
      try {
        await unlink(absPath)
      } catch {
        // 文件可能已不存在，忽略错误
      }
    }
  }

  // 2. 尝试删除批次目录（如果为空）
  const batchDir = resolve(process.cwd(), '..', 'data', 'uploads', 'invoices', batch.batchNo)
  try {
    const remaining = await readdir(batchDir)
    if (remaining.length === 0) {
      await rmdir(batchDir)
    }
  } catch {
    // 目录可能已不存在，忽略
  }

  // 3. 删除 DB 记录（发票会因外键约束自动级联删除，但 batchId 是可选的，需手动删除）
  await prisma.invoice.deleteMany({ where: { batchId: id } })
  await prisma.invoiceBatch.delete({ where: { id } })

  // 4. 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '发票管理',
      content: `删除发票批次「${batch.batchNo}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
