/**
 * 获取合同列表 API
 * GET /api/contracts
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?type=&supplierName=（可选筛选）
 * 成功返回: Contract[]，按 id 降序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

/** 序列化合同记录（Decimal → number） */
function serializeContract(c: any) {
  return {
    ...c,
    amount: Number(c.amount),
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const type = query.type as string | undefined
  const supplierName = query.supplierName as string | undefined

  const where: Record<string, any> = {}
  if (type) where.type = type
  if (supplierName) where.supplierName = { contains: supplierName }

  const contracts = await prisma.contract.findMany({
    where,
    orderBy: { id: 'desc' },
  })

  return contracts.map(serializeContract)
})
