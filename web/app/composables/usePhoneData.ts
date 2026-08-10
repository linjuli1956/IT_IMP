/**
 * 固话数据源（分页 CRUD，遵循资产通用模式）
 */
import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { PhoneItem, PhoneListResponse, PhoneQueryParams } from '~/types/phone'

/** 运营商选项 */
export const phoneCarrierOptions = [
  { value: '电信', label: '电信' },
  { value: '移动', label: '移动' },
  { value: '联通', label: '联通' },
  { value: '其他', label: '其他' },
]

const phoneList = ref<PhoneItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
let requestSeq = 0

async function fetchPhones(params: PhoneQueryParams = {}) {
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
    if (params.carrier) query.carrier = params.carrier
    if (params.status) query.status = params.status

    const data = await get<PhoneListResponse>('/api/phones', { query })
    if (seq !== requestSeq) return
    phoneList.value = data.list
    total.value = data.total
    page.value = data.page
    pageSize.value = data.pageSize
  } catch (e) {
    if (seq === requestSeq) error.value = getApiErrorMessage(e)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function addPhone(data: Partial<PhoneItem>) {
  const { post } = useApi()
  await post('/api/phones', data)
}

async function updatePhone(id: number, data: Partial<PhoneItem>) {
  const { put } = useApi()
  await put(`/api/phones/${id}`, data)
}

async function deletePhone(id: number) {
  const { delete: del } = useApi()
  await del(`/api/phones/${id}`)
}

export function usePhoneData() {
  return {
    phoneList, total, page, pageSize, loading, error,
    phoneCarrierOptions, assetStatusOptions,
    fetchPhones, addPhone, updatePhone, deletePhone,
  }
}
