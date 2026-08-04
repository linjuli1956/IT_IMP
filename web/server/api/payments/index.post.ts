/**
 * 新增支付配置 API
 * POST /api/payments
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { storeId, storeName, payMethod, payMethodName, provider, configName, configValue, posNo?, status?, isSensitive? }
 * 必填: storeId, storeName, payMethod, provider, configName, configValue
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { storeId, storeName, payMethod, payMethodName, provider, configName, configValue, posNo, status, isSensitive } = body

  if (!storeId) {
    throw createError({ statusCode: 400, message: '机构代码不能为空' })
  }
  if (!storeName) {
    throw createError({ statusCode: 400, message: '门店名称不能为空' })
  }
  if (!payMethod) {
    throw createError({ statusCode: 400, message: '支付方式不能为空' })
  }
  if (!provider) {
    throw createError({ statusCode: 400, message: '服务商不能为空' })
  }
  if (!configName) {
    throw createError({ statusCode: 400, message: '配置项名称不能为空' })
  }
  if (!configValue) {
    throw createError({ statusCode: 400, message: '配置值不能为空' })
  }

  const config = await prisma.paymentConfig.create({
    data: {
      storeId,
      storeName,
      payMethod,
      payMethodName: payMethodName || '',
      provider,
      configName,
      configValue,
      posNo: posNo || '',
      status: status || '正常',
      isSensitive: isSensitive || false,
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

  return config
})
