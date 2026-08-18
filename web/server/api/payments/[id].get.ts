/**
 * 获取支付配置详情 API
 * GET /api/payments/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: PaymentConfig DTO（isSensitive=true 时不含 configValue，附带 sensitiveConfigured 标记）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { toPaymentDto } from '../../utils/sensitive-dto'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const config = await prisma.paymentConfig.findUnique({ where: { id } })

  if (!config) {
    throw createError({ statusCode: 404, message: '支付配置不存在' })
  }

  return toPaymentDto(config)
})
