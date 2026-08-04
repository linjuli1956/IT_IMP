/**
 * 操作日志筛选项 API
 * GET /api/logs/options
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireRole(event)

  const [users, actions, modules] = await Promise.all([
    prisma.operationLog.findMany({ distinct: ['username'], select: { username: true }, orderBy: { username: 'asc' } }),
    prisma.operationLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    prisma.operationLog.findMany({ distinct: ['module'], select: { module: true }, orderBy: { module: 'asc' } }),
  ])

  return {
    usernames: users.map(item => item.username),
    actions: actions.map(item => item.action),
    modules: modules.map(item => item.module),
  }
})
