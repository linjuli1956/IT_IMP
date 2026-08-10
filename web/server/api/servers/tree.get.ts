/**
 * 全部服务器列表 API（树形视图用）
 * GET /api/servers/tree
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 说明: 全量返回不分页（含 vmCount/hostServerName，不含 password/dbPassword），
 *       供"全部"树形视图（物理机为父节点展开其下虚拟机）使用。
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { toSafeServer } from '../../utils/server-dto'

export default defineEventHandler(async (event) => {
  requireRole(event)

  const servers = await prisma.server.findMany({
    // 物理机在前，虚拟机按 id 升序（组树时顺序稳定）
    orderBy: [{ isVirtual: 'asc' }, { id: 'asc' }],
    include: {
      _count: { select: { virtualMachines: true } },
      hostServer: { select: { id: true, name: true, manageUrl: true } },
    },
  })

  return servers.map(s => ({
    ...toSafeServer(s),
    vmCount: s._count.virtualMachines,
    hostServerName: s.hostServer?.name ?? null,
    hostManageUrl: s.hostServer?.manageUrl ?? null,
  }))
})
