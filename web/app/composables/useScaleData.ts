/**
 * 电子称数据源（分页 CRUD，遵循资产通用模式）
 */
import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { ScaleItem, ScaleListResponse, ScaleQueryParams } from '~/types/scale'

export const scaleCalibrationOptions = [
  { value: 'overdue', label: '已逾期' },
  { value: 'soon', label: '即将校准（90天内）' },
  { value: 'ok', label: '正常' },
]

export const scaleInterfaceOptions = [
  { value: 'RS232', label: 'RS232' },
  { value: 'USB', label: 'USB' },
  { value: 'WiFi', label: 'WiFi' },
  { value: '蓝牙', label: '蓝牙' },
]

const scaleList = ref<ScaleItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
let requestSeq = 0

async function fetchScales(params: ScaleQueryParams = {}) {
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
    if (params.calibration) query.calibration = params.calibration

    const data = await get<ScaleListResponse>('/api/scales', { query })
    if (seq !== requestSeq) return
    scaleList.value = data.list
    total.value = data.total
    page.value = data.page
    pageSize.value = data.pageSize
  } catch (e) {
    if (seq === requestSeq) error.value = getApiErrorMessage(e)
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

async function addScale(data: Partial<ScaleItem>) {
  const { post } = useApi()
  await post('/api/scales', data)
}

async function updateScale(id: number, data: Partial<ScaleItem>) {
  const { put } = useApi()
  await put(`/api/scales/${id}`, data)
}

async function deleteScale(id: number) {
  const { delete: del } = useApi()
  await del(`/api/scales/${id}`)
}

export function useScaleData() {
  return {
    scaleList, total, page, pageSize, loading, error,
    scaleInterfaceOptions, scaleCalibrationOptions,
    fetchScales, addScale, updateScale, deleteScale,
  }
}
