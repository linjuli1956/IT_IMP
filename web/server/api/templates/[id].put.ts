/**
 * 编辑计提模板 API
 * PUT /api/templates/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { carrier?, store?, reimbursementFormat?, reimbursementCustom?, items? }
 * 允许部分更新；若提供 items 则自动更新 itemCount
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
    throw createError({ statusCode: 400, message: '无效的模板ID' })
  }

  const body = await readBody(event)

  // 构造更新数据（仅允许白名单字段）
  const data: Record<string, any> = { updateTime: new Date() }
  if (body.carrier !== undefined) data.carrier = body.carrier
  if (body.store !== undefined) data.store = body.store
  if (body.reimbursementFormat !== undefined) data.reimbursementFormat = body.reimbursementFormat
  if (body.reimbursementCustom !== undefined) data.reimbursementCustom = body.reimbursementCustom
  if (body.items !== undefined) {
    data.items = body.items
    data.itemCount = body.items.length
  }

  const record = await prisma.accrualTemplate.update({
    where: { id },
    data,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '模板管理',
      content: `修改模板「${record.carrier}_${record.store}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...record,
    updateTime: formatDate(record.updateTime),
    items: record.items,
  }
})
