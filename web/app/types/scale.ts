/** 电子称类型定义（门店电子称：量程/精度/校准） */

export interface ScaleItem {
  id: number
  storeId: number
  storeName: string | null
  assetNo: string | null
  brand: string | null
  model: string | null
  serialNo: string | null
  capacityKg: number | null
  precisionG: number | null
  interface: string | null
  lastCalibrationDate: string | null
  nextCalibrationDate: string | null
  calibrationCycleDays: number | null
  installLocation: string | null
  status: string
  remark: string
  createdAt: string
  updatedAt: string
}

export interface ScaleListResponse {
  list: ScaleItem[]
  total: number
  page: number
  pageSize: number
}

export interface ScaleQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  storeId?: number
  status?: string
  calibration?: string
}
