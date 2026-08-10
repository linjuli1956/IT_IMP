/**
 * 删除服务器 API
 * DELETE /api/servers/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 规则: 该服务器名下仍有虚拟机时返回 409（禁止级联删除）
 * 成功返回: { success: true }
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const server = await prisma.server.findUnique({
    where: { id },
    include: { _count: { select: { virtualMachines: true } } },
  })
  if (!server) {
    throw createError({ statusCode: 404, message: '服务器不存在' })
  }
  if (server._count.virtualMachines > 0) {
    throw createError({
      statusCode: 409,
      message: `该宿主机仍有 ${server._count.virtualMachines} 台虚拟机，无法删除，请先删除或迁移其虚拟机`,
    })
  }

  try {
    // 删除与操作日志同一事务：日志失败则整体回滚，避免"数据已删但接口报错"
    await prisma.$transaction([
      prisma.server.delete({ where: { id } }),
      prisma.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '删除',
          module: 'IT资产管理',
          content: `删除服务器「${server.name}」`,
          ip: getClientIp(event),
        },
      }),
    ])
  } catch (error: any) {
    // 并发兜底：删除瞬间被挂上虚拟机（外键 Restrict 触发 P2003）→ 友好 409
    if (error?.code === 'P2003') {
      throw createError({ statusCode: 409, message: '该服务器已被挂载虚拟机或仍被引用，无法删除' })
    }
    throw error
  }

  return { success: true }
})
