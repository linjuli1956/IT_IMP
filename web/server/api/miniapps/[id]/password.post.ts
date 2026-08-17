/**
 * 小程序邮箱密码显式查看 API（沿用服务器凭据模式）
 * POST /api/miniapps/:id/password
 * 请求头: Authorization: Bearer xxx (仅管理员或操作员，查看者 403)
 * 请求体: { action: 'view' }
 * 返回: { emailPassword }
 * 安全: 密码不写入操作日志；日志仅记录"查看了邮箱密码"动作与对象
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

  const miniapp = await prisma.miniapp.findUnique({
    where: { id },
    select: { id: true, name: true, emailPassword: true },
  })
  if (!miniapp) {
    throw createError({ statusCode: 404, message: '小程序不存在' })
  }

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '查看',
      module: 'IT资产管理',
      content: `查看小程序「${miniapp.name}」邮箱密码`,
      ip: getClientIp(event),
    },
  })

  return { emailPassword: miniapp.emailPassword }
})
