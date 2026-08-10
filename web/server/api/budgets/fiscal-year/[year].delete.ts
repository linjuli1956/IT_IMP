/**
 * 删除整个财年的预算数据 API
 * DELETE /api/budgets/fiscal-year/:year
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 行为: 事务删除该财年全部预算明细与执行对比数据（不可恢复）
 */
import { prisma } from '../../../utils/prisma'
import { requireRole, getClientIp } from '../../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const year = Number(getRouterParam(event, 'year'))

  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw createError({ statusCode: 400, message: '无效的财年' })
  }

  // 事务删除：预算明细 + 执行对比数据 + 操作日志（同事务，日志写入失败则整体回滚）
  const [detailResult, executionResult] = await prisma.$transaction([
    prisma.budgetDetail.deleteMany({ where: { fiscalYear: year } }),
    prisma.budgetExecution.deleteMany({ where: { fiscalYear: year } }),
    prisma.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '删除',
        module: '预算管理',
        content: `删除 ${year} 财年全部预算数据（明细+执行对比）`,
        ip: getClientIp(event),
      },
    }),
  ])

  return {
    success: true,
    detailCount: detailResult.count,
    executionCount: executionResult.count,
  }
})
