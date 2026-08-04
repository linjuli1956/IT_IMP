/**
 * 删除用户 API
 * DELETE /api/users/:id
 * 请求头: Authorization: Bearer xxx (需管理员角色)
 * 成功返回: { success: true }
 * 失败返回: 400 "默认管理员账号不可删除"
 */
import { prisma } from '../../utils/prisma'
import { getUserFromEvent, getClientIp } from '../../utils/auth'
import { type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = getUserFromEvent(event)

  // 未登录
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  // 管理员权限校验
  if (user.role !== '管理员') {
    throw createError({ statusCode: 403, message: '权限不足，仅管理员可操作' })
  }

  const id = parseInt(getRouterParam(event, 'id') as string, 10)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' })
  }

  // 查询用户是否存在
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true },
  })

  if (!target) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // admin 账号不可删除
  if (target.username === 'admin') {
    throw createError({ statusCode: 400, message: '默认管理员账号不可删除' })
  }

  // 不能删除自己
  if (target.id === user.userId) {
    throw createError({ statusCode: 400, message: '不能删除当前登录的账号' })
  }

  // 删除用户
  await prisma.user.delete({
    where: { id },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '系统管理',
      content: `删除用户「${target.username}」（${target.name}）`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
