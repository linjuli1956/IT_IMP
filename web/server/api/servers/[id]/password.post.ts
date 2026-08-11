/**
 * 服务器密码查看/更新 API（独立接口，安全收敛）
 * POST /api/servers/:id/password
 * 请求头: Authorization: Bearer xxx (仅管理员或操作员，查看者 403)
 * 请求体: { action: 'view' | 'update', password?, dbPassword? }
 *  - view：返回 { password, dbPassword }（内网可选保存的服务器凭据，管理员/操作员显式查看）
 *  - update：更新传入的密码字段（仅更新提供的字段），不返回新密码
 * 安全: 密码不写入操作日志；日志仅记录"查看/更新了密码"
 */
import { prisma } from '../../../utils/prisma'
import { parsePositiveSafeId } from '../../../utils/request-validation'
import { requireRole, getClientIp } from '../../../utils/auth'
import { validatePasswordBody } from '../../../utils/password-validation'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody(event)
  const result = validatePasswordBody(body)
  if (!result.valid) {
    throw createError({ statusCode: result.statusCode, message: result.message })
  }

  const server = await prisma.server.findUnique({
    where: { id },
    select: { id: true, name: true, password: true, dbPassword: true },
  })
  if (!server) {
    throw createError({ statusCode: 404, message: '服务器不存在' })
  }

  if (result.action === 'view') {
    await prisma.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '查看',
        module: 'IT资产管理',
        content: `查看服务器「${server.name}」登录凭据`,
        ip: getClientIp(event),
      },
    })
    return { password: server.password, dbPassword: server.dbPassword }
  }

  // update：只更新提供的字段；传空字符串视为清空
  const data = result.data

  // 更新凭据 + 写操作日志：同一事务，保证原子性
  await prisma.$transaction([
    prisma.server.update({ where: { id }, data }),
    prisma.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '编辑',
        module: 'IT资产管理',
        content: `更新服务器「${server.name}」登录凭据`,
        ip: getClientIp(event),
      },
    }),
  ])

  return { success: true }
})
