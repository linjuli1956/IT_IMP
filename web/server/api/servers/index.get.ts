/**
 * 获取服务器列表 API（分页）
 * GET /api/servers?page=&pageSize=&isVirtual=&hostServerId=&serverType=&keyword=
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 返回: { list, total, page, pageSize }
 * 安全: 返回体**不含** password / dbPassword；列表项含 vmCount（该宿主下虚拟机数）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getQuery, type H3Event } from 'h3'
import { toSafeServer, parsePagination, parseBooleanStrict, parsePositiveIntStrict, SERVER_STATUS_VALUES, HYPERVISOR_VALUES } from '../../utils/server-dto'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const { page, pageSize, skip } = parsePagination(query)

  const where: Record<string, unknown> = {}

  // 严格校验筛选参数（非法 → 400，不静默修正）
  if (query.isVirtual !== undefined && query.isVirtual !== '') {
    const v = parseBooleanStrict(query.isVirtual)
    if (v === undefined) throw createError({ statusCode: 400, message: 'isVirtual 必须是布尔值' })
    where.isVirtual = v
  }
  if (query.hostServerId) {
    const hostId = parsePositiveIntStrict(query.hostServerId)
    if (hostId === undefined) throw createError({ statusCode: 400, message: 'hostServerId 必须是不小于 1 的整数' })
    where.hostServerId = hostId
  }
  if (query.serverType) {
    where.serverType = String(query.serverType)
  }
  if (query.status) {
    const status = String(query.status)
    if (!SERVER_STATUS_VALUES.includes(status as never)) {
      throw createError({ statusCode: 400, message: `status 只允许 ${SERVER_STATUS_VALUES.join('/')}` })
    }
    where.status = status
  }
  if (query.hypervisor) {
    const hypervisor = String(query.hypervisor)
    if (!HYPERVISOR_VALUES.includes(hypervisor as never)) {
      throw createError({ statusCode: 400, message: `hypervisor 只允许 ${HYPERVISOR_VALUES.join('/')}` })
    }
    where.hypervisor = hypervisor
  }
  if (query.keyword) {
    const keyword = String(query.keyword)
    where.OR = [
      { name: { contains: keyword } },
      { internalIp: { contains: keyword } },
      { model: { contains: keyword } },
      { manufacturer: { contains: keyword } },
    ]
  }

  const [servers, total] = await Promise.all([
    prisma.server.findMany({
      where,
      orderBy: { id: 'desc' },
      skip,
      take: pageSize,
      include: {
        _count: { select: { virtualMachines: true } },
        hostServer: { select: { id: true, name: true, manageUrl: true } },
      },
    }),
    prisma.server.count({ where }),
  ])

  return {
    list: servers.map(s => ({
      ...toSafeServer(s),
      vmCount: s._count.virtualMachines,
      hostServerName: s.hostServer?.name ?? null,
      hostManageUrl: s.hostServer?.manageUrl ?? null,
    })),
    total,
    page,
    pageSize,
  }
})
