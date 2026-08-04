/**
 * 获取预算明细列表 API
 * GET /api/budgets
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?fiscalYear=&storeName=&carrier=（可选筛选）
 * 成功返回: BudgetDetail[]，按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

/** 序列化预算明细（Decimal → number） */
function serializeBudgetDetail(d: any) {
  return {
    ...d,
    monthlyFee: Number(d.monthlyFee),
    annualFee: Number(d.annualFee),
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const fiscalYear = query.fiscalYear as string | undefined
  const storeName = query.storeName as string | undefined
  const carrier = query.carrier as string | undefined

  const where: Record<string, any> = {}
  if (fiscalYear) where.fiscalYear = Number(fiscalYear)
  if (storeName) where.storeName = { contains: storeName }
  if (carrier) where.carrier = carrier

  const details = await prisma.budgetDetail.findMany({
    where,
    orderBy: { id: 'asc' },
  })

  return details.map(serializeBudgetDetail)
})
