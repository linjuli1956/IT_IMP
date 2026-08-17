/**
 * 获取小程序列表 API
 * GET /api/miniapps
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Miniapp DTO[]（不含 emailPassword，附带 emailPasswordSet 标记），按 id 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { toMiniappDto } from '../../utils/sensitive-dto'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const miniapps = await prisma.miniapp.findMany({ orderBy: { id: 'asc' } })
  return miniapps.map(toMiniappDto)
})
