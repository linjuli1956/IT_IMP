/**
 * 新增域名 API
 * POST /api/domains
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { domain, mainAccount, mainPassword, certType?, certIssuer?, certRenewDate?, certExpireDate?, remark?, status? }
 * 必填: domain, mainAccount, mainPassword
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { domain, mainAccount, mainPassword } = body

  if (!domain) {
    throw createError({ statusCode: 400, message: '域名不能为空' })
  }
  if (!mainAccount) {
    throw createError({ statusCode: 400, message: '主账号不能为空' })
  }
  if (!mainPassword) {
    throw createError({ statusCode: 400, message: '主账号密码不能为空' })
  }

  const record = await prisma.domain.create({
    data: {
      domain,
      mainAccount,
      mainPassword,
      certType: body.certType || '',
      certIssuer: body.certIssuer || '',
      certRenewDate: body.certRenewDate || '',
      certExpireDate: body.certExpireDate || '',
      remark: body.remark || '',
      status: body.status || '正常',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: 'IT资产管理',
      content: `新增域名「${domain}」`,
      ip: getClientIp(event),
    },
  })

  return record
})
