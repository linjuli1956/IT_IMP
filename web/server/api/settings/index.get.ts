/**
 * 系统设置查询 API
 * GET /api/settings
 * 请求头: Authorization: Bearer xxx (需登录，所有角色可读)
 * 返回: 全部设置项 { key: value } 映射（如 { startMonth: "4" }）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireRole(event)

  const settings = await prisma.appSetting.findMany()
  return Object.fromEntries(settings.map(s => [s.key, s.value]))
})
