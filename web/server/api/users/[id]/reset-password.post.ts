/**
 * 重置用户密码 API
 * POST /api/users/:id/reset-password
 * 请求头: Authorization: Bearer xxx (需管理员角色)
 * 成功返回: { success: true }
 * 失败返回: 400 "默认管理员账号不可重置" / 403 (非管理员)
 * admin 密码只能通过修改密码页更改
 */
import { prisma } from '../../../utils/prisma'
import { getUserFromEvent, hashPassword, getClientIp } from '../../../utils/auth'
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
    select: { id: true, username: true },
  })

  if (!target) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // admin 账号不可重置密码
  if (target.username === 'admin') {
    throw createError({ statusCode: 400, message: '默认管理员账号不可重置' })
  }

  // 重置密码为默认密码 123456
  await prisma.user.update({
    where: { id },
    data: { passwordHash: hashPassword('123456') },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '系统管理',
      content: `重置用户「${target.username}」的密码为默认密码`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
