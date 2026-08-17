/**
 * 支付配置敏感值显式查看 API（沿用服务器凭据模式）
 * POST /api/payments/:id/config-value
 * 请求头: Authorization: Bearer xxx (仅管理员或操作员，查看者 403)
 * 请求体: { action: 'view' }
 * 返回: { configValue, isSensitive }
 * 安全: 敏感值不写入操作日志；日志仅记录"查看了敏感配置值"动作与对象
 */
import { prisma } from '../../../utils/prisma'
import { parsePositiveSafeId } from '../../../utils/request-validation'
import { requireRole, getClientIp } from '../../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody(event)
  if (!body || body.action !== 'view') {
    throw createError({ statusCode: 400, message: '非法请求：action 必须为 view' })
  }

  const config = await prisma.paymentConfig.findUnique({
    where: { id },
    select: { id: true, storeName: true, configName: true, configValue: true, isSensitive: true },
  })
  if (!config) {
    throw createError({ statusCode: 404, message: '支付配置不存在' })
  }

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '查看',
      module: '支付管理',
      content: `查看支付配置「${config.storeName}-${config.configName}」配置值`,
      ip: getClientIp(event),
    },
  })

  return { configValue: config.configValue, isSensitive: config.isSensitive }
})
