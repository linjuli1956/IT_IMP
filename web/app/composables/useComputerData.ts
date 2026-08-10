/**
 * 电脑数据源（分页 CRUD，遵循资产通用模式）
 */
import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { ComputerItem, ComputerListResponse, ComputerQueryParams } from '~/types/computer'

export const computerDiskTypeOptions = [
  { value: 'SSD', label: 'SSD' },
  { value: 'HDD', label: 'HDD' },
  { value: 'SSD+HDD', label: 'SSD+HDD' },
]

const computerList = ref<ComputerItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
let requestSeq = 0

async function fetchComputers(params: ComputerQueryParams = {}) {
  const seq = ++requestSeq
  loading.value = true
  error.value = ''
  try {
    const { get } = useApi()
    const query: Record<string, string | number | undefined> = {
      page: params.page ?? page.value,
      pageSize: params.pageSize ?? pageSize.value,
    }
    if (params.keyword) query.keyword = params.keyword
    if (params.storeId) query.storeId = params.storeId
    if (params.status) query.status = params.status

    const data = await get<ComputerListResponse>('/api/computers', { query })
    if (seq !== requestSeq) return
    computerList.value = data.list
    total.value = data.total
    page.value = data.page
    pageSize.value = data.pageSize
  } catch (e) {
    if (seq === requestSeq) error.value = getApiErrorMessage(e)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function addComputer(data: Partial<ComputerItem>) {
  const { post } = useApi()
  await post('/api/computers', data)
}

async function updateComputer(id: number, data: Partial<ComputerItem>) {
  const { put } = useApi()
  await put(`/api/computers/${id}`, data)
}

async function deleteComputer(id: number) {
  const { delete: del } = useApi()
  await del(`/api/computers/${id}`)
}

export function useComputerData() {
  return {
    computerList, total, page, pageSize, loading, error,
    computerDiskTypeOptions,
    fetchComputers, addComputer, updateComputer, deleteComputer,
  }
}
