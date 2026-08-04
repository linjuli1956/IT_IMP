/**
 * 新增供应商 API
 * POST /api/suppliers
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name, type, contact?, phone?, address?, remark? }
 * 必填: name, type
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { name, type, contact, phone, address, remark } = body

  if (!name) {
    throw createError({ statusCode: 400, message: '供应商名称不能为空' })
  }
  if (!type) {
    throw createError({ statusCode: 400, message: '供应商类型不能为空' })
  }

  const supplier = await prisma.supplier.create({
    data: {
      name,
      type,
      contact: contact || '',
      phone: phone || '',
      address: address || '',
      remark: remark || '',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '基础配置',
      content: `新增供应商「${name}」`,
      ip: getClientIp(event),
    },
  })

  return supplier
})
