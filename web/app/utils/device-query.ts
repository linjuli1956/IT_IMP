/**
 * 网络设备筛选查询构建（纯函数，可单测）
 * 将 AssetFilters 发出的增量 patch 合并进 filters 后构建 API 查询参数（回第 1 页）。
 */

export interface DeviceFilters {
  keyword?: string
  deviceType?: string
  storeId?: number | undefined
  status?: string
}

/** 合并增量 patch 并回第 1 页（patch 中存在 key 即视为修改，undefined 表示清空） */
export function applyDeviceFilterPatch(filters: DeviceFilters, patch: Record<string, any>): DeviceFilters {
  return {
    keyword: 'keyword' in patch ? (patch.keyword || undefined) : filters.keyword,
    deviceType: 'deviceType' in patch ? (patch.deviceType || undefined) : filters.deviceType,
    storeId: 'storeId' in patch ? (patch.storeId || undefined) : filters.storeId,
    status: 'status' in patch ? (patch.status || undefined) : filters.status,
  }
}

/** 构建 API query 参数（默认 page=1，pageSize 可选透传） */
export function buildDeviceQuery(filters: DeviceFilters, page = 1, pageSize?: number): Record<string, any> {
  const query: Record<string, any> = { page }
  if (pageSize) query.pageSize = pageSize
  if (filters.keyword) query.keyword = filters.keyword
  if (filters.deviceType) query.deviceType = filters.deviceType
  if (filters.storeId) query.storeId = filters.storeId
  if (filters.status) query.status = filters.status
  return query
}
