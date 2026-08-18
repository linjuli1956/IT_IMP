/**
 * 编辑支付配置 API
 * PUT /api/payments/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 允许部分更新；configValue 为空/未提供时不更新（防止留空意外清空已保存敏感值）
 * 成功返回: PaymentConfig DTO（isSensitive=true 时不含 configValue）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toPaymentDto } from '../../utils/sensitive-dto'
import { parsePositiveSafeId, ensurePlainObjectBody, pickStringUpdateFields } from '../../utils/request-validation'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = ensurePlainObjectBody(await readBody(event))
  // 白名单挑选：未知字段/id 不落库；configValue 空值 = 不修改
  const data = pickStringUpdateFields(body, [
    { key: 'storeId', label: '机构代码' },
    { key: 'storeName', label: '门店名称' },
    { key: 'payMethod', label: '支付方式' },
    { key: 'payMethodName', label: '支付方式名称' },
    { key: 'provider', label: '服务商' },
    { key: 'configName', label: '配置项名称' },
    { key: 'configValue', label: '配置值', sensitive: true },
    { key: 'posNo', label: 'POS号' },
    { key: 'status', label: '状态' },
  ])
  if (body.isSensitive !== undefined) {
    if (typeof body.isSensitive !== 'boolean') {
      throw createError({ statusCode: 400, message: '是否敏感必须是布尔值' })
    }
    data.isSensitive = body.isSensitive
  }

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
