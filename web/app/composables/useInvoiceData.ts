/**
 * 发票/批次 共享数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useDetailData.ts 模式：全局单例 + useApi() + loading ref + try/catch + getApiErrorMessage
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { InvoiceFile, Batch } from '~/types/invoice'
export type { InvoiceFile, Batch }

// 全局共享（单例）
const batchList = ref<Batch[]>([])
const invoiceList = ref<InvoiceFile[]>([])
const loading = ref(false)

/** 批次查询参数 */
export interface BatchQueryParams {
  carrier?: string
  feeMonth?: string
  status?: string
}

/** 发票查询参数 */
export interface InvoiceQueryParams {
  carrier?: string
  feeMonth?: string
  store?: string
  batchId?: number
}

/**
 * 获取批次列表
 * @param params 筛选条件（可选）
 */
async function fetchBatches(params?: BatchQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    batchList.value = await get<Batch[]>('/api/invoices/batches', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 获取批次详情（含发票列表）
 * @param id 批次ID
 */
async function fetchBatchById(id: number): Promise<Batch | null> {
  try {
    const { get } = useApi()
    return await get<Batch>(`/api/invoices/batches/${id}`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 获取发票列表
 * @param params 筛选条件（可选）
 */
async function fetchInvoices(params?: InvoiceQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    invoiceList.value = await get<InvoiceFile[]>('/api/invoices', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 创建批次（仅创建批次记录，不含文件上传）
 * @param data { carrier, feeMonth, store }
 * @returns 创建的批次，失败返回 null
 */
async function createBatch(data: {
  carrier: string
  feeMonth: string
  store: string
}): Promise<Batch | null> {
  try {
    const { post } = useApi()
    const batch = await post<Batch>('/api/invoices/batches', data)
    // 将新批次添加到列表头部
    batchList.value.unshift(batch)
    return batch
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 上传发票文件（PDF/ZIP）— 服务端自动 OCR
 * @param formData 包含 batchId, files 的 FormData
 * @returns { invoices, batch }，失败返回 null
 */
async function uploadInvoices(formData: FormData): Promise<{ invoices: InvoiceFile[]; batch: Batch } | null> {
  try {
    const { post } = useApi()
    const result = await post<{ invoices: InvoiceFile[]; batch: Batch }>('/api/invoices/upload', formData)
    // 更新列表中的批次数据
    const idx = batchList.value.findIndex(b => b.id === result.batch.id)
    if (idx > -1) {
      batchList.value[idx] = { ...result.batch, invoices: result.invoices }
    } else {
      batchList.value.unshift({ ...result.batch, invoices: result.invoices })
    }
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 确认 OCR 结果（批量更新发票信息并设状态为 ocr-confirmed）
 * @param data 包含 invoices 数组的确认数据
 * @returns 更新后的批次信息，失败返回 null
 */
async function confirmInvoices(data: {
  invoices: Array<{
    id: number
    invoiceNumber: string
    invoiceDate: string
    sellerName: string
    amount: number
    stores: string[]
  }>
}): Promise<{ batch: Batch } | null> {
  try {
    const { post } = useApi()
    const result = await post<{ batch: Batch }>('/api/invoices/confirm', data)
    // 更新本地 batchList
    if (result.batch) {
      const idx = batchList.value.findIndex(b => b.id === result.batch.id)
      if (idx > -1) {
        batchList.value[idx] = { ...batchList.value[idx], ...result.batch }
      }
    }
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 删除批次（级联删除发票 + 物理文件）
 * @param id 批次ID
 */
async function deleteBatch(id: number) {
  try {
    const { delete: del } = useApi()
    await del(`/api/invoices/batches/${id}`)
    const idx = batchList.value.findIndex(b => b.id === id)
    if (idx > -1) {
      batchList.value.splice(idx, 1)
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

/**
 * 批量删除批次
 * @param ids 批次ID数组
 */
async function deleteBatches(ids: number[]) {
  for (const id of ids) {
    await deleteBatch(id)
  }
}

/**
 * 删除单张发票（同时删除PDF文件）
 * @param id 发票ID
 */
async function deleteInvoice(id: number) {
  try {
    const { delete: del } = useApi()
    await del(`/api/invoices/${id}`)
    const idx = invoiceList.value.findIndex(i => i.id === id)
    if (idx > -1) {
      invoiceList.value.splice(idx, 1)
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

/**
 * 批量删除发票
 * @param ids 发票ID数组
 */
async function deleteInvoices(ids: number[]) {
  for (const id of ids) {
    await deleteInvoice(id)
  }
}

/**
 * 根据 ID 获取批次（同步，从内存列表查找）
 * 注意：需先调用 fetchBatches() 加载数据
 */
function getBatchById(id: number): Batch | undefined {
  return batchList.value.find(b => b.id === id)
}

/**
 * 批次状态文本
 */
function getBatchStatusText(status: Batch['status']): string {
  const map: Record<Batch['status'], string> = {
    pending: '待计提',
    accrued: '已计提',
    printed: '已打印',
  }
  return map[status] || status
}

/**
 * 批次状态对应的tag类型
 */
function getBatchStatusType(status: Batch['status']): 'primary' | 'success' | 'warning' | 'info' {
  const map: Record<Batch['status'], 'primary' | 'success' | 'warning' | 'info'> = {
    pending: 'warning',
    accrued: 'primary',
    printed: 'success',
  }
  return map[status] || 'info'
}

/**
 * 运营商缩写映射
 */
const carrierAbbr: Record<string, string> = {
  '中国电信': 'DX',
  '中国联通': 'LT',
  '中国移动': 'YD',
  '广西广电': 'GD',
}

/**
 * 批次号格式化
 * 优先使用数据库存储的 batchNo，无则按规则生成
 */
function formatBatchNo(b: any): string {
  if (!b) return ''
  if (b.batchNo) return b.batchNo
  // Fallback：按规则生成
  const month = b.feeMonth?.replace('-', '') || '000000'
  const abbr = carrierAbbr[b.carrier] || 'XX'
  const seq = String(b.id).padStart(2, '0')
  return `${month}${abbr}${seq}`
}

export function useInvoiceData() {
  return {
    batchList,
    invoiceList,
    loading,
    fetchBatches,
    fetchBatchById,
    fetchInvoices,
    createBatch,
    uploadInvoices,
    confirmInvoices,
    deleteBatch,
    deleteBatches,
    deleteInvoice,
    deleteInvoices,
    getBatchById,
    getBatchStatusText,
    getBatchStatusType,
    formatBatchNo,
  }
}
