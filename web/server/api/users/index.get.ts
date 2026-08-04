/**
 * 获取用户列表 API
 * GET /api/users
 * 请求头: Authorization: Bearer xxx
 * 成功返回: User[] (不含 passwordHash)
 */
import { prisma } from '../../utils/prisma'
import { getUserFromEvent } from '../../utils/auth'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = getUserFromEvent(event)

  // 未登录
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  // 查询所有用户，排除 passwordHash
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      name: true,
      role: true,
      status: true,
      lastLogin: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { id: 'asc' },
  })

  return users
})
