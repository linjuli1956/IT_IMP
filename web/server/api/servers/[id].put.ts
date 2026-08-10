/**
 * 编辑服务器 API
 * PUT /api/servers/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 白名单字段（**不含 password/dbPassword**，密码走独立接口）
 * 校验: 修改 isVirtual / hostServerId 时重新执行完整虚拟化约束（服务层）
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'
import { toSafeServer, validateServerFields, validateVmHypervisor } from '../../utils/server-dto'
import { validateServerVirtualization } from '../../utils/server-validation'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const existing = await prisma.server.findUnique({
    where: { id },
    select: { id: true, isVirtual: true, hostServerId: true, cpuCoresAllocated: true, memoryAllocatedGB: true, diskAllocatedGB: true },
  })
  if (!existing) {
    throw createError({ statusCode: 404, message: '服务器不存在' })
  }

  // 服务层字段校验（严格校验非法参数 → 400；可空唯一字段空串→NULL）
  const { data, errors } = validateServerFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  // 计算"新值"（body 覆盖原值），对 isVirtual/hostServerId 的变更重新完整校验
  // existing 的 Decimal 字段需转 number 再参与校验
  const toNum = (v: unknown): number | null => (v == null ? null : Number(v))
  const newIsVirtual = data.isVirtual !== undefined ? (data.isVirtual as boolean) : existing.isVirtual
  const newHostServerId = data.hostServerId !== undefined ? (data.hostServerId as number | null) : existing.hostServerId
  const newCpu = data.cpuCoresAllocated !== undefined ? (data.cpuCoresAllocated as number | null) : toNum(existing.cpuCoresAllocated)
  const newMemory = data.memoryAllocatedGB !== undefined ? (data.memoryAllocatedGB as number | null) : toNum(existing.memoryAllocatedGB)
  const newDisk = data.diskAllocatedGB !== undefined ? (data.diskAllocatedGB as number | null) : toNum(existing.diskAllocatedGB)

  let hostServer: { id: number; isVirtual: boolean; hypervisor: string | null } | null = null
  if (newHostServerId != null) {
    hostServer = await prisma.server.findUnique({
      where: { id: newHostServerId },
      select: { id: true, isVirtual: true, hypervisor: true },
    })
  }
  const validation = validateServerVirtualization({
    id: existing.id,
    isVirtual: newIsVirtual,
    hostServerId: newHostServerId,
    cpuCoresAllocated: newCpu,
    memoryAllocatedGB: newMemory,
    diskAllocatedGB: newDisk,
  }, hostServer)
  if (!validation.valid) {
    throw createError({ statusCode: validation.statusCode, message: validation.error })
  }

  // VM 平台必须与宿主机一致（hypervisor 归属物理宿主机，VM 继承；服务端为准）
  if (newIsVirtual && hostServer) {
    const hvError = validateVmHypervisor(
      newIsVirtual, newHostServerId,
      data.hypervisor as string | null, hostServer.hypervisor,
    )
    if (hvError) {
      throw createError({ statusCode: 400, message: hvError })
    }
    data.hypervisor = hostServer.hypervisor
  } else if (!newIsVirtual) {
    // 物理机：允许独立填写 PVE/ESXi（不清空）
  }

  const server = await prisma.server.update({ where: { id }, data })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: 'IT资产管理',
      content: `编辑服务器「${server.name}」`,
      ip: getClientIp(event),
    },
  })

  return toSafeServer(server)
})
