/**
 * 编辑小程序 API
 * PUT /api/miniapps/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 全部字段（除 id 外）
 * 允许部分更新；emailPassword 为空/未提供时不更新（防止留空意外清空已保存密码）
 * 成功返回: Miniapp DTO（不含 emailPassword）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toMiniappDto, omitEmptySensitiveFields } from '../../utils/sensitive-dto'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id) {
    throw createError({ statusCode: 400, message: '无效的ID' })
  }

  const body = await readBody(event)
  const data = omitEmptySensitiveFields(body, ['emailPassword'])

  const miniapp = await prisma.miniapp.update({
    where: { id },
    data,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: 'IT资产管理',
      content: `编辑小程序「${miniapp.name}」`,
      ip: getClientIp(event),
    },
  })

  return toMiniappDto(miniapp)
})
