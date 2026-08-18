/**
 * 新增支付配置 API
 * POST /api/payments
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { storeId, storeName, payMethod, payMethodName, provider, configName, configValue, posNo?, status?, isSensitive? }
 * 必填: storeId, storeName, payMethod, provider, configName, configValue
 * 成功返回: PaymentConfig DTO（isSensitive=true 时不含 configValue）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toPaymentDto } from '../../utils/sensitive-dto'
import { ensurePlainObjectBody, requireStringField, optionalStringField } from '../../utils/request-validation'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = ensurePlainObjectBody(await readBody(event))
  const storeId = requireStringField(body, 'storeId', '机构代码')
  const storeName = requireStringField(body, 'storeName', '门店名称')
  const payMethod = requireStringField(body, 'payMethod', '支付方式')
  const provider = requireStringField(body, 'provider', '服务商')
  const configName = requireStringField(body, 'configName', '配置项名称')
  const configValue = requireStringField(body, 'configValue', '配置值')
  const isSensitiveRaw = body.isSensitive
  if (isSensitiveRaw !== undefined && typeof isSensitiveRaw !== 'boolean') {
    throw createError({ statusCode: 400, message: '是否敏感必须是布尔值' })
  }

  const config = await prisma.paymentConfig.create({
    data: {
      storeId,
      storeName,
      payMethod,
      payMethodName: optionalStringField(body, 'payMethodName', '支付方式名称') || '',
      provider,
      configName,
      configValue,
      posNo: optionalStringField(body, 'posNo', 'POS号') || '',
      status: optionalStringField(body, 'status', '状态') || '正常',
      isSensitive: isSensitiveRaw ?? false,
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '支付管理',
      content: `新增支付配置「${storeName}-${configName}」`,
      ip: getClientIp(event),
    },
  })

  return toPaymentDto(config)
})
