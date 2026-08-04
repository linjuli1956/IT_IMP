/**
 * 编辑预算明细 API
 * PUT /api/budgets/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 允许部分更新
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)

  const detail = await prisma.budgetDetail.update({
    where: { id },
    data: body,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '预算管理',
      content: `编辑预算明细「${detail.storeName}-${detail.carrier}-${detail.feeType}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...detail,
    monthlyFee: Number(detail.monthlyFee),
    annualFee: Number(detail.annualFee),
  }
})
