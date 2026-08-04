/**
 * 获取合同详情 API
 * GET /api/contracts/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Contract
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

  const contract = await prisma.contract.findUnique({ where: { id } })

  if (!contract) {
    throw createError({ statusCode: 404, message: '合同不存在' })
  }

  return {
    ...contract,
    amount: Number(contract.amount),
  }
})
