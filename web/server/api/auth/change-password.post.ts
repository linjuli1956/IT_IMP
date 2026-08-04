/**
 * 修改密码 API
 * POST /api/auth/change-password
 * 请求头: Authorization: Bearer xxx
 * 请求体: { oldPassword, newPassword }
 * 成功返回: { success: true }
 * 失败返回: 400 "旧密码不正确" / 401 (未登录)
 */
import { prisma } from '../../utils/prisma'
import { getUserFromEvent, comparePassword, hashPassword, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = getUserFromEvent(event)

  // 未登录
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  const body = await readBody(event)
  const { oldPassword, newPassword } = body

  // 参数校验
  if (!oldPassword || !newPassword) {
    throw createError({ statusCode: 400, message: '旧密码和新密码不能为空' })
  }

  // 查询当前用户的密码哈希
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { passwordHash: true },
  })

  if (!dbUser) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  // 旧密码校验
  if (!comparePassword(oldPassword, dbUser.passwordHash)) {
    throw createError({ statusCode: 400, message: '旧密码不正确' })
  }

  // 更新密码
  await prisma.user.update({
    where: { id: user.userId },
    data: { passwordHash: hashPassword(newPassword) },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '系统管理',
      content: '修改密码',
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
