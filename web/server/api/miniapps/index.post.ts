/**
 * 新增小程序 API
 * POST /api/miniapps
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name, email, emailPassword, remark?, status? }
 * 必填: name, email, emailPassword
 * 成功返回: Miniapp DTO（不含 emailPassword）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toMiniappDto } from '../../utils/sensitive-dto'
import { ensurePlainObjectBody, requireStringField, optionalStringField } from '../../utils/request-validation'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = ensurePlainObjectBody(await readBody(event))
  const name = requireStringField(body, 'name', '小程序名称')
  const email = requireStringField(body, 'email', '关联邮箱')
  const emailPassword = requireStringField(body, 'emailPassword', '邮箱密码')

  const miniapp = await prisma.miniapp.create({
    data: {
      name,
      email,
      emailPassword,
      remark: optionalStringField(body, 'remark', '备注') || '',
      status: optionalStringField(body, 'status', '状态') || '正常',
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

  return toMiniappDto(miniapp)
})
