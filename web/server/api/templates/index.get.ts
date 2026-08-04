/**
 * 获取计提模板列表 API
 * GET /api/templates
 * 请求头: Authorization: Bearer xxx
 * 查询参数: ?carrier=中国电信&store=总部信息部（可选筛选）
 * 成功返回: AccrualTemplate[]，按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 序列化模板记录（Date → string） */
function serializeTemplate(t: any) {
  return {
    ...t,
    updateTime: formatDate(t.updateTime),
    items: t.items,
  }
}

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const carrier = query.carrier as string | undefined
  const store = query.store as string | undefined

  const where: Record<string, string> = {}
  if (carrier) where.carrier = carrier
  if (store) where.store = store

  const templates = await prisma.accrualTemplate.findMany({
    where,
    orderBy: { id: 'asc' },
  })

  return templates.map(serializeTemplate)
})
