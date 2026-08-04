/**
 * 获取门店列表 API
 * GET /api/stores
 * 请求头: Authorization: Bearer xxx
 * 成功返回: Store[]，按 sort 升序
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import type { H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event) // 只要求登录，不限角色
  return await prisma.store.findMany({ orderBy: { sort: 'asc' } })
})
