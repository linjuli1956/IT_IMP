/**
 * 获取预算执行对比列表 API
 * GET /api/budgets/executions
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?fiscalYear=&month=（可选筛选）
 * 成功返回: BudgetExecution[]，按 month 降序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

/** 序列化预算执行记录（Decimal → number） */
function serializeExecution(e: any) {
  return {
    ...e,
    budgetAmount: Number(e.budgetAmount),
    actualAmount: Number(e.actualAmount),
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const fiscalYear = query.fiscalYear as string | undefined
  const month = query.month as string | undefined

  const where: Record<string, any> = {}
  if (fiscalYear) where.fiscalYear = Number(fiscalYear)
  if (month) where.month = month

  const executions = await prisma.budgetExecution.findMany({
    where,
    orderBy: { month: 'desc' },
  })

  return executions.map(serializeExecution)
})
