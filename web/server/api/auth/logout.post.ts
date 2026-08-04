/**
 * 用户登出 API
 * POST /api/auth/logout
 * 请求头: Authorization: Bearer xxx
 * 成功返回: { success: true }
 * 不做 token 黑名单，仅记录操作日志
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

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '登出',
      module: '系统管理',
      content: '用户登出系统',
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
