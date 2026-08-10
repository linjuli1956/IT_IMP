/** 固话类型定义（门店/部门固话） */

export interface PhoneItem {
  id: number
  storeId: number
  storeName: string | null
  department: string | null
  phoneNumber: string
  extension: string | null
  carrier: string | null          // 电信/移动/联通/其他
  monthlyFee: number | null       // 月租（元）
  packageInfo: string | null
  user: string | null             // 使用人
  installLocation: string | null
  status: string                  // 正常/停用/报废
  remark: string
  createdAt: string
  updatedAt: string
}

export interface PhoneListResponse {
  list: PhoneItem[]
  total: number
  page: number
  pageSize: number
}

export interface PhoneQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  storeId?: number
  carrier?: string
  status?: string
}
