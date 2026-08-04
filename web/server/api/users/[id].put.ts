/**
 * 更新用户信息 API
 * PUT /api/users/:id
 * 请求头: Authorization: Bearer xxx (需管理员角色)
 * 请求体: { name, role, status }
 * 成功返回: 更新后的用户(不含 passwordHash)
 * 不涉及密码修改
 */
import { prisma } from '../../utils/prisma'
import { getUserFromEvent, getClientIp } from '../../utils/auth'
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

  const id = parseInt(getRouterParam(event, 'id') as string, 10)
  if (isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的用户ID' })
  }

  const body = await readBody(event)
  const { name, role, status } = body

  // 参数校验
  if (name === undefined && role === undefined && status === undefined) {
    throw createError({ statusCode: 400, message: '没有需要更新的字段' })
  }

  // 检查用户是否存在
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  })

  if (!existing) {
    throw createError({ statusCode: 404, message: '用户不存在' })
  }

  // admin 账号不可禁用
  if (existing.username === 'admin' && status === 0) {
    throw createError({ statusCode: 400, message: '默认管理员账号不可禁用' })
  }

  // 构建更新数据
  const updateData: { name?: string; role?: string; status?: number } = {}
  if (name !== undefined) updateData.name = name
  if (role !== undefined) updateData.role = role
  if (status !== undefined) updateData.status = status

  // 更新用户
  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
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
  })

  // 构建日志内容
  const changes: string[] = []
  if (name !== undefined) changes.push(`姓名→${name}`)
  if (role !== undefined) changes.push(`角色→${role}`)
  if (status !== undefined) changes.push(`状态→${status === 1 ? '启用' : '禁用'}`)

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '系统管理',
      content: `编辑用户「${existing.username}」：${changes.join('，')}`,
      ip: getClientIp(event),
    },
  })

  return updated
})
