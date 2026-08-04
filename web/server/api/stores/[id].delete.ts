/**
 * 删除门店 API
 * DELETE /api/stores/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const store = await prisma.store.delete({ where: { id } })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '基础配置',
      content: `删除门店「${store.name}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
