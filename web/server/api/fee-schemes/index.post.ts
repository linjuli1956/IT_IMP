/**
 * 新增费用分摊方案 API
 * POST /api/fee-schemes
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name, carrier?, items?, reimbursementFormat?, reimbursementCustom?, status? }
 * 必填: name
 * 默认值: carrier='', items=[], reimbursementFormat='分摊明细型', status=1
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, createError, type H3Event } from 'h3'

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
  const body = await readBody(event)

  if (!body.name) {
    throw createError({ statusCode: 400, message: '方案名称不能为空' })
  }

  // 检查重复（同名方案）
  const existing = await prisma.feeAllocationScheme.findFirst({
    where: { name: body.name },
  })
  if (existing) {
    throw createError({ statusCode: 400, message: '该方案名称已存在' })
  }

  const items = body.items || []
  const record = await prisma.feeAllocationScheme.create({
    data: {
      name: body.name,
      carrier: body.carrier || '',
      items: items,
      reimbursementFormat: body.reimbursementFormat || '分摊明细型',
      reimbursementCustom: body.reimbursementCustom || '',
      status: body.status !== undefined ? Number(body.status) : 1,
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '费用分摊',
      content: `新增费用分摊方案「${body.name}」（${items.length}个费用项）`,
      ip: getClientIp(event),
    },
  })

  return {
    ...record,
    updateTime: formatDate(record.updateTime),
    items: record.items,
  }
})
