/**
 * 获取服务器列表 API
 * GET /api/servers
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Server[]，按 id 升序
 * 包含所有字段（含 password/dbAccount/dbPassword，前端用 SensitiveValue 脱敏）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  return await prisma.server.findMany({ orderBy: { id: 'asc' } })
})
