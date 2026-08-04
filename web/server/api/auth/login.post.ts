/**
 * 用户登录 API
 * POST /api/auth/login
 * 请求体: { username, password }
 * 成功返回: { token, user: { id, username, name, role } }
 */
import { prisma } from '../../utils/prisma'
import { comparePassword, signToken, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const body = await readBody(event)
  const { username, password } = body

  // 参数校验
  if (!username || !password) {
    throw createError({ statusCode: 400, message: '用户名和密码不能为空' })
  }

  // 查询用户
  const user = await prisma.user.findUnique({
    where: { username },
  })

  // 用户不存在
  if (!user) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  // 账号已禁用
  if (user.status === 0) {
    throw createError({ statusCode: 403, message: '该账号已禁用' })
  }

  // 密码校验
  if (!comparePassword(password, user.passwordHash)) {
    throw createError({ statusCode: 401, message: '用户名或密码错误' })
  }

  // 签发 token
  const token = signToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  })

  // 更新最后登录时间
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.id,
      username: user.username,
      action: '登录',
      module: '系统管理',
      content: '用户登录系统',
      ip: getClientIp(event),
    },
  })

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
    },
  }
})
