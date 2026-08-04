/**
 * 新增计提模板 API
 * POST /api/templates
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { carrier, store, reimbursementFormat?, reimbursementCustom?, items? }
 * 必填: carrier, store
 * 默认值: reimbursementFormat='分摊明细型', reimbursementCustom='', items=[]
 * 自动计算: itemCount = items.length
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
  const { carrier, store } = body

  if (!carrier) {
    throw createError({ statusCode: 400, message: '运营商不能为空' })
  }
  if (!store) {
    throw createError({ statusCode: 400, message: '门店/机构不能为空' })
  }

  // 检查重复（同一运营商+门店）
  const existing = await prisma.accrualTemplate.findFirst({
    where: { carrier, store },
  })
  if (existing) {
    throw createError({ statusCode: 400, message: '该运营商+门店的模板已存在' })
  }

  const items = body.items || []
  const record = await prisma.accrualTemplate.create({
    data: {
      carrier,
      store,
      itemCount: items.length,
      reimbursementFormat: body.reimbursementFormat || '分摊明细型',
      reimbursementCustom: body.reimbursementCustom || '',
      items: items,
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '模板管理',
      content: `新增模板「${carrier}_${store}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...record,
    updateTime: formatDate(record.updateTime),
    items: record.items,
  }
})
