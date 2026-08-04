/**
 * 新增小程序 API
 * POST /api/miniapps
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name, email, emailPassword, remark?, status? }
 * 必填: name, email, emailPassword
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { name, email, emailPassword } = body

  if (!name) {
    throw createError({ statusCode: 400, message: '小程序名称不能为空' })
  }
  if (!email) {
    throw createError({ statusCode: 400, message: '关联邮箱不能为空' })
  }
  if (!emailPassword) {
    throw createError({ statusCode: 400, message: '邮箱密码不能为空' })
  }

  const miniapp = await prisma.miniapp.create({
    data: {
      name,
      email,
      emailPassword,
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
      content: `新增小程序「${name}」`,
      ip: getClientIp(event),
    },
  })

  return miniapp
})
