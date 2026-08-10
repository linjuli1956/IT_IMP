/**
 * 全部物理机列表 API（宿主下拉 / 详情页上一台·下一台导航）
 * GET /api/servers/hosts
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 说明: 物理机数量级小（预期 < 500），全量返回不分页；超出后需改分页（见需求文档）。
 * 返回: [{ id, name, internalIp, hypervisor }]（isVirtual=false，按 id 升序）
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  requireRole(event)

  const hosts = await prisma.server.findMany({
    where: { isVirtual: false },
    orderBy: { id: 'asc' },
    select: { id: true, name: true, internalIp: true, hypervisor: true },
  })

  return hosts
})
