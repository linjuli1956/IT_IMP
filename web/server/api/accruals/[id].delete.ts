/**
 * 删除计提表 API
 * DELETE /api/accruals/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 * 副作用：恢复关联批次状态为 pending
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的计提表ID' })
  }

  // 查询计提表（获取 batchId 和 batchNo 用于日志和恢复状态）
  const accrual = await prisma.accrual.findUnique({
    where: { id },
    select: { id: true, batchId: true, batchNo: true },
  })

  if (!accrual) {
    throw createError({ statusCode: 404, message: '计提表不存在或已删除' })
  }

  // 删除计提表
  await prisma.accrual.delete({ where: { id } })

  // 恢复批次状态为 pending
  await prisma.invoiceBatch.update({
    where: { id: accrual.batchId },
    data: { status: 'pending' },
  })

  // 操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '计提管理',
      content: `删除计提表「${accrual.batchNo}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
