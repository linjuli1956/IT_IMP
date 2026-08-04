/**
 * 获取支付配置列表 API
 * GET /api/payments
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?storeName=&payMethod=&provider=（可选筛选）
 * 成功返回: PaymentConfig[]，按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const storeName = query.storeName as string | undefined
  const payMethod = query.payMethod as string | undefined
  const provider = query.provider as string | undefined

  const where: Record<string, any> = {}
  if (storeName) where.storeName = { contains: storeName }
  if (payMethod) where.payMethod = payMethod
  if (provider) where.provider = provider

  return await prisma.paymentConfig.findMany({
    where,
    orderBy: { id: 'asc' },
  })
})
