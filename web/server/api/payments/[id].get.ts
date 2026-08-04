/**
 * 获取支付配置详情 API
 * GET /api/payments/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: PaymentConfig
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const config = await prisma.paymentConfig.findUnique({ where: { id } })

  if (!config) {
    throw createError({ statusCode: 404, message: '支付配置不存在' })
  }

  return config
})
