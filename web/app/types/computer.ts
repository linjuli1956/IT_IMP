/** 电脑类型定义（门店电脑：配置 + IP） */

export interface ComputerItem {
  id: number
  storeId: number
  storeName: string | null
  assetNo: string | null
  department: string | null
  brand: string | null
  model: string | null
  serialNo: string | null
  user: string | null
  cpuModel: string | null
  cpuCores: number | null
  memoryGB: number | null
  diskSizeGB: number | null
  diskType: string | null
  ipAddress: string | null
  macAddress: string | null
  os: string | null
  osVersion: string | null
  purchaseDate: string | null
  warrantyEndDate: string | null
  status: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface ComputerListResponse {
  list: ComputerItem[]
  total: number
  page: number
  pageSize: number
}

export interface ComputerQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  storeId?: number
  status?: string
}
