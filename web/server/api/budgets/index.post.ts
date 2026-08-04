/**
 * 新增/批量导入预算明细 API
 * POST /api/budgets
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 单条 { fiscalYear, storeName, carrier, ... } 或数组 [{ ... }, ...]
 * 必填: fiscalYear, storeName, carrier, feeType
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)

  // 批量导入：body 为数组
  if (Array.isArray(body)) {
    if (body.length === 0) {
      throw createError({ statusCode: 400, message: '批量导入数据不能为空' })
    }
    // 校验必填字段
    for (const item of body) {
      if (!item.fiscalYear || !item.storeName || !item.carrier || !item.feeType) {
        throw createError({ statusCode: 400, message: '每条记录需包含 fiscalYear, storeName, carrier, feeType' })
      }
    }
    const result = await prisma.budgetDetail.createMany({
      data: body.map((item: any) => ({
        fiscalYear: Number(item.fiscalYear),
        storeName: item.storeName,
        carrier: item.carrier,
        feeType: item.feeType,
        monthlyFee: item.monthlyFee || 0,
        annualFee: item.annualFee || 0,
        feeRange: item.feeRange || '',
        broadbandType: item.broadbandType || '',
        paymentMethod: item.paymentMethod || '',
        remark: item.remark || '',
      })),
    })

    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '新增',
        module: '预算管理',
        content: `批量导入预算明细 ${result.count} 条`,
        ip: getClientIp(event),
      },
    })

    return { success: true, count: result.count }
  }

  // 单条新增
  const { fiscalYear, storeName, carrier, feeType, monthlyFee, annualFee, feeRange, broadbandType, paymentMethod, remark } = body

  if (!fiscalYear) {
    throw createError({ statusCode: 400, message: '财年不能为空' })
  }
  if (!storeName) {
    throw createError({ statusCode: 400, message: '门店名称不能为空' })
  }
  if (!carrier) {
    throw createError({ statusCode: 400, message: '运营商不能为空' })
  }
  if (!feeType) {
    throw createError({ statusCode: 400, message: '费用类型不能为空' })
  }

  const detail = await prisma.budgetDetail.create({
    data: {
      fiscalYear: Number(fiscalYear),
      storeName,
      carrier,
      feeType,
      monthlyFee: monthlyFee || 0,
      annualFee: annualFee || 0,
      feeRange: feeRange || '',
      broadbandType: broadbandType || '',
      paymentMethod: paymentMethod || '',
      remark: remark || '',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '预算管理',
      content: `新增预算明细「${storeName}-${carrier}-${feeType}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...detail,
    monthlyFee: Number(detail.monthlyFee),
    annualFee: Number(detail.annualFee),
  }
})
