/**
 * 删除费用分摊方案 API
 * DELETE /api/fee-schemes/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的方案ID' })
  }

  const scheme = await prisma.feeAllocationScheme.findUnique({ where: { id } })
  if (!scheme) {
    throw createError({ statusCode: 404, message: '费用分摊方案不存在' })
  }

  await prisma.feeAllocationScheme.delete({ where: { id } })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '费用分摊',
      content: `删除费用分摊方案「${scheme.name}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
