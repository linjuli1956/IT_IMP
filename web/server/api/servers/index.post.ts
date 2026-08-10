/**
 * 新增服务器 API
 * POST /api/servers
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 白名单字段（**不含 password/dbPassword**，密码走独立接口）
 * 必填: name, serverType
 * 校验: 服务层虚拟化约束（validateServerVirtualization）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'
import { toSafeServer, validateServerFields, validateVmHypervisor } from '../../utils/server-dto'
import { validateServerVirtualization } from '../../utils/server-validation'
import type { Prisma } from '../../../generated/prisma/client'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody<Record<string, unknown>>(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }
  if (!body.name || !String(body.name).trim()) {
    throw createError({ statusCode: 400, message: '服务器名称不能为空' })
  }
  if (!body.serverType) {
    throw createError({ statusCode: 400, message: '服务器类型不能为空' })
  }

  // 服务层字段校验（严格校验非法参数 → 400）
  const { data, errors } = validateServerFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  // 服务层虚拟化约束校验（宿主信息由本 API 查询传入）
  const hostServerId = data.hostServerId as number | null | undefined
  let hostServer: { id: number; isVirtual: boolean; hypervisor: string | null } | null = null
  if (hostServerId != null) {
    hostServer = await prisma.server.findUnique({
      where: { id: hostServerId },
      select: { id: true, isVirtual: true, hypervisor: true },
    })
  }
  const validation = validateServerVirtualization({
    isVirtual: data.isVirtual as boolean,
    hostServerId: hostServerId ?? null,
    cpuCoresAllocated: data.cpuCoresAllocated as number | null,
    memoryAllocatedGB: data.memoryAllocatedGB as number | null,
    diskAllocatedGB: data.diskAllocatedGB as number | null,
  }, hostServer)
  if (!validation.valid) {
    throw createError({ statusCode: validation.statusCode, message: validation.error })
  }

  // VM 平台必须与宿主机一致（hypervisor 归属物理宿主机，VM 继承）
  if (data.isVirtual && hostServer) {
    const hvError = validateVmHypervisor(
      data.isVirtual as boolean, hostServerId ?? null,
      data.hypervisor as string | null, hostServer.hypervisor,
    )
    if (hvError) {
      throw createError({ statusCode: 400, message: hvError })
    }
    // 继承宿主机平台（前端只读展示，服务端为准）；VM 不保存自身管理地址
    data.hypervisor = hostServer.hypervisor
    data.manageUrl = null
  }

  const server = await prisma.server.create({ data: data as Prisma.ServerUncheckedCreateInput })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: 'IT资产管理',
      content: `新增服务器「${server.name}」`,
      ip: getClientIp(event),
    },
  })

  return toSafeServer(server)
})
