/**
 * 新增用户 API
 * POST /api/users
 * 请求头: Authorization: Bearer xxx (需管理员角色)
 * 请求体: { username, name, role }
 * 成功返回: { id, username, name, role, status, createdAt }
 * 失败返回: 403 (非管理员) / 400 (用户名已存在)
 */
import { prisma } from '../../utils/prisma'
import { getUserFromEvent, hashPassword, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

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

  const body = await readBody(event)
  const { username, name, role } = body

  // 参数校验
  if (!username || !name || !role) {
    throw createError({ statusCode: 400, message: '用户名、姓名和角色不能为空' })
  }

  // 检查用户名唯一性
  const existing = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  })

  if (existing) {
    throw createError({ statusCode: 400, message: '用户名已存在' })
  }

  // 创建用户，默认密码 123456
  const newUser = await prisma.user.create({
    data: {
      username,
      name,
      role,
      passwordHash: hashPassword('123456'),
      status: 1,
    },
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      createdAt: true,
    },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '系统管理',
      content: `新增用户「${username}」，角色：${role}`,
      ip: getClientIp(event),
    },
  })

  return newUser
})
