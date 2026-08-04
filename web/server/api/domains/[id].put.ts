/**
 * 编辑域名 API
 * PUT /api/domains/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 全部字段（除 id 外）
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

  const record = await prisma.domain.update({
    where: { id },
    data: body,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: 'IT资产管理',
      content: `编辑域名「${record.domain}」`,
      ip: getClientIp(event),
    },
  })

  return record
})
