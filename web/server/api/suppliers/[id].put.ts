/**
 * 编辑供应商 API
 * PUT /api/suppliers/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name?, type?, contact?, phone?, address?, remark? }
 * 允许部分更新
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

  const supplier = await prisma.supplier.update({
    where: { id },
    data: body,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '基础配置',
      content: `编辑供应商「${supplier.name}」`,
      ip: getClientIp(event),
    },
  })

  return supplier
})
