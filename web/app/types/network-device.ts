/** 网络设备类型定义（门店网络设备：交换机/路由器/AP等） */

export interface NetworkDeviceItem {
  id: number
  storeId: number
  storeName: string | null
  deviceType: string        // 交换机/路由器/AP/防火墙/其他
  manageType: string | null // 网管型/非网管
  brand: string | null
  model: string | null
  serialNo: string | null
  managementIp: string | null
  macAddress: string | null
  portCount: number | null
  uplinkPort: string | null
  firmwareVersion: string | null
  installLocation: string | null
  status: string            // 正常/停用/报废
  remark: string
  createdAt: string
  updatedAt: string
}

/** 列表响应（分页） */
export interface NetworkDeviceListResponse {
  list: NetworkDeviceItem[]
  total: number
  page: number
  pageSize: number
}

/** 列表查询条件 */
export interface NetworkDeviceQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  deviceType?: string
  storeId?: number
  status?: string
}
