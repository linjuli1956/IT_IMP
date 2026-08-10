/**
 * 网络设备数据源（分页 CRUD，遵循资产通用模式）
 */
import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { NetworkDeviceItem, NetworkDeviceListResponse, NetworkDeviceQueryParams } from '~/types/network-device'

/** 设备类型选项（与后端枚举一致） */
export const networkDeviceTypeOptions = [
  { value: '交换机', label: '交换机' },
  { value: '路由器', label: '路由器' },
  { value: 'AP', label: 'AP' },
  { value: '防火墙', label: '防火墙' },
  { value: '其他', label: '其他' },
]

/** 管理类型选项 */
export const networkManageTypeOptions = [
  { value: '网管型', label: '网管型' },
  { value: '非网管', label: '非网管' },
]

const deviceList = ref<NetworkDeviceItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
/** 列表错误状态（错误/空/表格三态互斥，错误时页面显示持续可见提示） */
const error = ref('')
let requestSeq = 0

async function fetchDevices(params: NetworkDeviceQueryParams = {}) {
  const seq = ++requestSeq
  loading.value = true
  error.value = '' // 请求开始时清空错误
  try {
    const { get } = useApi()
    const query: Record<string, string | number | undefined> = {
      page: params.page ?? page.value,
      pageSize: params.pageSize ?? pageSize.value,
    }
    if (params.keyword) query.keyword = params.keyword
    if (params.deviceType) query.deviceType = params.deviceType
    if (params.storeId) query.storeId = params.storeId
    if (params.status) query.status = params.status

    const data = await get<NetworkDeviceListResponse>('/api/network-devices', { query })
    if (seq !== requestSeq) return
    deviceList.value = data.list
    total.value = data.total
    page.value = data.page
    pageSize.value = data.pageSize
    error.value = '' // 成功时清空错误
  } catch (e) {
    if (seq === requestSeq) {
      error.value = getApiErrorMessage(e) // 仅当前有效请求失败时设置，防旧请求覆盖
    }
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function addDevice(data: Partial<NetworkDeviceItem>) {
  const { post } = useApi()
  await post('/api/network-devices', data)
}

async function updateDevice(id: number, data: Partial<NetworkDeviceItem>) {
  const { put } = useApi()
  await put(`/api/network-devices/${id}`, data)
}

async function deleteDevice(id: number) {
  const { delete: del } = useApi()
  await del(`/api/network-devices/${id}`)
}

export function useNetworkDeviceData() {
  return {
    deviceList, total, page, pageSize, loading, error,
    networkDeviceTypeOptions, networkManageTypeOptions, assetStatusOptions,
    fetchDevices, addDevice, updateDevice, deleteDevice,
  }
}
