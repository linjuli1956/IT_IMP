/**
 * 获取服务器详情 API
 * GET /api/servers/:id
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 行为: 物理机 → 返回 hostServer(null) + virtualMachines(全部虚拟机)；
 *       虚拟机 → 返回 hostServer(宿主信息) + virtualMachines(空)。
 * 安全: 返回体**不含** password / dbPassword。
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { toSafeServer } from '../../utils/server-dto'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const server = await prisma.server.findUnique({
    where: { id },
    include: {
      hostServer: {
        select: { id: true, name: true, internalIp: true, isVirtual: true, hypervisor: true, os: true, manageUrl: true },
      },
      virtualMachines: {
        orderBy: { id: 'asc' },
        select: {
          id: true, name: true, internalIp: true, os: true, purpose: true, status: true,
          cpuCoresAllocated: true, memoryAllocatedGB: true, diskAllocatedGB: true, hypervisor: true,
        },
      },
    },
  })

  if (!server) {
    throw createError({ statusCode: 404, message: '服务器不存在' })
  }

  return toSafeServer(server)
})
