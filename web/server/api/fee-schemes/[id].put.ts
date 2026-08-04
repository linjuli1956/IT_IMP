/**
 * 编辑费用分摊方案 API
 * PUT /api/fee-schemes/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name?, carrier?, items?, reimbursementFormat?, reimbursementCustom?, status? }
 * 允许部分更新
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, createError, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的方案ID' })
  }

  const body = await readBody(event)

  // 如果修改了名称，检查重复
  if (body.name) {
    const existing = await prisma.feeAllocationScheme.findFirst({
      where: { name: body.name, NOT: { id } },
    })
    if (existing) {
      throw createError({ statusCode: 400, message: '该方案名称已存在' })
    }
  }

  // 构造更新数据（仅允许白名单字段，updateTime 由 @updatedAt 自动更新）
  const data: Record<string, any> = {}
  if (body.name !== undefined) data.name = body.name
  if (body.carrier !== undefined) data.carrier = body.carrier
  if (body.items !== undefined) data.items = body.items
  if (body.reimbursementFormat !== undefined) data.reimbursementFormat = body.reimbursementFormat
  if (body.reimbursementCustom !== undefined) data.reimbursementCustom = body.reimbursementCustom
  if (body.status !== undefined) data.status = Number(body.status)

  const record = await prisma.feeAllocationScheme.update({
    where: { id },
    data,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '费用分摊',
      content: `修改费用分摊方案「${record.name}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...record,
    updateTime: formatDate(record.updateTime),
    items: record.items,
  }
})
