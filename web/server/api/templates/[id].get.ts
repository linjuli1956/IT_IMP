/**
 * 获取计提模板详情 API
 * GET /api/templates/:id
 * 请求头: Authorization: Bearer xxx
 * 成功返回: AccrualTemplate（含 items JSON）
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
    throw createError({ statusCode: 400, message: '无效的模板ID' })
  }

  const template = await prisma.accrualTemplate.findUnique({
    where: { id },
  })

  if (!template) {
    throw createError({ statusCode: 404, message: '模板不存在或已删除' })
  }

  return {
    ...template,
    updateTime: formatDate(template.updateTime),
    items: template.items,
  }
})
