/**
 * 域名主账号密码显式查看 API（沿用服务器凭据模式）
 * POST /api/domains/:id/password
 * 请求头: Authorization: Bearer xxx (仅管理员或操作员，查看者 403)
 * 请求体: { action: 'view' }
 * 返回: { mainPassword }
 * 安全: 密码不写入操作日志；日志仅记录"查看了主账号密码"动作与对象
 */
import { prisma } from '../../../utils/prisma'
import { parsePositiveSafeId } from '../../../utils/request-validation'
import { requireRole, getClientIp } from '../../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody(event)
  if (!body || body.action !== 'view') {
    throw createError({ statusCode: 400, message: '非法请求：action 必须为 view' })
  }

  const domain = await prisma.domain.findUnique({
    where: { id },
    select: { id: true, domain: true, mainPassword: true },
  })
  if (!domain) {
    throw createError({ statusCode: 404, message: '域名不存在' })
  }

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '查看',
      module: 'IT资产管理',
      content: `查看域名「${domain.domain}」主账号密码`,
      ip: getClientIp(event),
    },
  })

  return { mainPassword: domain.mainPassword }
})
