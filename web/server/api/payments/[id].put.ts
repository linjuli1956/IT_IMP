/**
 * 编辑支付配置 API
 * PUT /api/payments/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 允许部分更新；configValue 为空/未提供时不更新（防止留空意外清空已保存敏感值）
 * 成功返回: PaymentConfig DTO（isSensitive=true 时不含 configValue）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toPaymentDto, omitEmptySensitiveFields } from '../../utils/sensitive-dto'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)
  const data = omitEmptySensitiveFields(body, ['configValue'])

  const config = await prisma.paymentConfig.update({
    where: { id },
    data,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '支付管理',
      content: `编辑支付配置「${config.storeName}-${config.configName}」`,
      ip: getClientIp(event),
    },
  })

  return toPaymentDto(config)
})
