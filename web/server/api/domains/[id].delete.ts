/**
 * 删除域名 API
 * DELETE /api/domains/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const record = await prisma.domain.delete({ where: { id } })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: 'IT资产管理',
      content: `删除域名「${record.domain}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
