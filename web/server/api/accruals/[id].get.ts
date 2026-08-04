/**
 * 计提表详情 API
 * GET /api/accruals/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Accrual（含 groups JSON 数据）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'

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
  requireRole(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的计提表ID' })
  }

  const accrual = await prisma.accrual.findUnique({
    where: { id },
  })

  if (!accrual) {
    throw createError({ statusCode: 404, message: '计提表不存在或已删除' })
  }

  return {
    ...accrual,
    totalAmount: Number(accrual.totalAmount),
    createTime: formatDate(accrual.createTime),
    groups: accrual.groups,
  }
})
