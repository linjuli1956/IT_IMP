/**
 * 操作日志列表 API
 * GET /api/logs?startDate=&endDate=&username=&action=&module=&page=&pageSize=
 */
import { getQuery, type H3Event } from 'h3'
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

const DEFAULT_PAGE_SIZE = 20
const MAX_PAGE_SIZE = 100

function parsePositiveInteger(value: unknown, fallback: number, maximum?: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return fallback
  return maximum ? Math.min(parsed, maximum) : parsed
}

function parseDate(value: unknown, endOfDay = false): Date | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined

  const date = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const second = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

export default defineEventHandler(async (event: H3Event) => {
  // 所有已登录用户均可查看操作日志。
  requireRole(event)

  const query = getQuery(event)
  const page = parsePositiveInteger(query.page, 1)
  const pageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const startDate = parseDate(query.startDate)
  const endDate = parseDate(query.endDate, true)

  const where: Record<string, unknown> = {}
  if (typeof query.username === 'string' && query.username) where.username = query.username
  if (typeof query.action === 'string' && query.action) where.action = query.action
  if (typeof query.module === 'string' && query.module) where.module = query.module
  if (startDate || endDate) {
    where.createdAt = {
      ...(startDate ? { gte: startDate } : {}),
      ...(endDate ? { lte: endDate } : {}),
    }
  }

  const [logs, total] = await Promise.all([
    prisma.operationLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        username: true,
        action: true,
        module: true,
        content: true,
        ip: true,
        createdAt: true,
      },
    }),
    prisma.operationLog.count({ where }),
  ])

  return {
    list: logs.map(log => ({ ...log, createdAt: formatDate(log.createdAt) })),
    total,
    page,
    pageSize,
  }
})
