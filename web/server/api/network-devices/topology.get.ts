/**
 * 获取网络拓扑数据 API（设备节点 + 连线）
 * GET /api/network-devices/topology?storeId=
 * 请求头: Authorization: Bearer xxx (所有登录角色)
 * 返回: { devices: [...], links: [...] }
 * 无连线时 links=[]，由前端显示 EmptyState
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { getQuery, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)

  const query = getQuery(event)
  const where: Record<string, unknown> = {}

  // 门店筛选（可选）—— 使用项目统一正安全整数解析
  if (query.storeId !== undefined && query.storeId !== null && query.storeId !== '') {
    where.storeId = parsePositiveSafeId(query.storeId, '门店ID')
  }

  // 设备节点：含门店名称
  const devices = await prisma.networkDevice.findMany({
    where,
    orderBy: { id: 'asc' },
    include: { store: { select: { id: true, name: true } } },
  })

  // 连线：两端设备 ID 必须都在筛选结果中
  const deviceIds = new Set(devices.map(d => d.id))
  const allLinks = await prisma.networkDeviceLink.findMany({
    orderBy: { id: 'asc' },
  })
  const links = allLinks.filter(
    l => deviceIds.has(l.sourceDeviceId) && deviceIds.has(l.targetDeviceId),
  )

  return {
    devices: devices.map(d => ({
      id: d.id,
      storeId: d.storeId,
      storeName: d.store?.name ?? null,
      deviceType: d.deviceType,
      manageType: d.manageType,
      brand: d.brand,
      model: d.model,
      serialNo: d.serialNo,
      managementIp: d.managementIp,
      macAddress: d.macAddress,
      portCount: d.portCount,
      uplinkPort: d.uplinkPort,
      firmwareVersion: d.firmwareVersion,
      installLocation: d.installLocation,
      status: d.status,
      remark: d.remark,
    })),
    links: links.map(l => ({
      id: l.id,
      sourceDeviceId: l.sourceDeviceId,
      sourcePort: l.sourcePort,
      targetDeviceId: l.targetDeviceId,
      targetPort: l.targetPort,
      linkType: l.linkType,
      remark: l.remark,
    })),
  }
})
