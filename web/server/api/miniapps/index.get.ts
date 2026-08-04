/**
 * 获取小程序列表 API
 * GET /api/miniapps
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Miniapp[]，按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  return await prisma.miniapp.findMany({ orderBy: { id: 'asc' } })
})
