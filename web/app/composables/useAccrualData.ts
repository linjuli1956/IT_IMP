/**
 * 计提表 共享数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useDetailData.ts / useInvoiceData.ts 模式：全局单例 + useApi() + loading ref + try/catch + getApiErrorMessage
 *
 * 计提生成逻辑已移至服务端 server/api/accruals/generate.post.ts
 * 前端仅负责：列表加载、详情查看、发起生成请求、删除、状态更新
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { AccrualRow, AccrualGroup, Accrual } from '~/types/accrual'
export type { AccrualRow, AccrualGroup, Accrual }

// 全局共享（单例）
const accrualList = ref<Accrual[]>([])
const loading = ref(false)

// ============================================
// 报销说明生成（共享实现，定义在 app/utils/reimbursement.ts）
// 服务端 generate.post.ts / [id].put.ts 与前端共用同一份实现
// ============================================
export { generateReimbursementText } from '~/utils/reimbursement'

// ============================================
// API 函数
// ============================================

/** 计提表查询参数 */
export interface AccrualQueryParams {
  carrier?: string
  feeMonth?: string
  status?: string
}

/**
 * 获取计提表列表
 * @param params 筛选条件（可选）
 */
async function fetchAccruals(params?: AccrualQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    accrualList.value = await get<Accrual[]>('/api/accruals', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 获取计提表详情
 * @param id 计提表ID
 */
async function fetchAccrualById(id: number): Promise<Accrual | null> {
  try {
    const { get } = useApi()
    const result = await get<Accrual>(`/api/accruals/${id}`)
    // 同步到列表（已存在则更新，不存在则追加）
    const idx = accrualList.value.findIndex(a => a.id === id)
    if (idx > -1) {
      accrualList.value[idx] = result
    } else {
      accrualList.value.push(result)
    }
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 生成计提表（调服务端 API）
 * @param data { batchId, templateOverrides?, detailTableId?, schemeId?, manualAdjustments? }
 * @returns 生成的计提表，失败返回 null
 */
async function generateAccrual(data: {
  batchId: number
  templateOverrides?: Record<string, number>
  detailTableId?: number
  schemeId?: number
  manualAdjustments?: Record<string, number>
}): Promise<Accrual | null> {
  try {
    const { post } = useApi()
    const result = await post<Accrual>('/api/accruals/generate', data)
    // 添加到列表头部
    accrualList.value.unshift(result)
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 删除计提表（同时恢复批次状态为 pending）
 * @param id 计提表ID
 */
async function deleteAccrual(id: number): Promise<void> {
  try {
    const { delete: del } = useApi()
    await del(`/api/accruals/${id}`)
    const idx = accrualList.value.findIndex(a => a.id === id)
    if (idx > -1) {
      accrualList.value.splice(idx, 1)
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

/**
 * 批量删除计提表
 * @param ids 计提表ID数组
 */
async function deleteAccruals(ids: number[]): Promise<void> {
  for (const id of ids) {
    await deleteAccrual(id)
  }
}

/**
 * 更新计提表状态（同步更新批次状态）
 * @param id 计提表ID
 * @param status 目标状态
 */
async function updateAccrualStatus(id: number, status: 'generated' | 'printed'): Promise<void> {
  try {
    const { put } = useApi()
    const result = await put<Accrual>(`/api/accruals/${id}`, { status })
    const idx = accrualList.value.findIndex(a => a.id === id)
    if (idx > -1) {
      accrualList.value[idx] = result
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

/**
 * 更新计提表（状态或内容）
 * @param id 计提表ID
 * @param data { status?, groups? }
 */
async function updateAccrual(id: number, data: {
  status?: 'generated' | 'printed'
  groups?: AccrualGroup[]
}): Promise<Accrual | null> {
  try {
    const { put } = useApi()
    const result = await put<Accrual>(`/api/accruals/${id}`, data)
    const idx = accrualList.value.findIndex(a => a.id === id)
    if (idx > -1) {
      accrualList.value[idx] = result
    }
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

// ============================================
// 同步方法（页面展示用）
// ============================================

/**
 * 根据ID获取计提表（同步，从内存列表查找）
 * 注意：需先调用 fetchAccruals() 加载数据
 */
function getAccrualById(id: number): Accrual | undefined {
  return accrualList.value.find(a => a.id === id)
}

/**
 * 根据批次ID获取计提表（同步，从内存列表查找）
 */
function getAccrualByBatchId(batchId: number): Accrual | undefined {
  return accrualList.value.find(a => a.batchId === batchId)
}

/**
 * 状态文本
 */
function getStatusText(status: Accrual['status']): string {
  const map: Record<Accrual['status'], string> = {
    generated: '已生成',
    printed: '已打印',
  }
  return map[status] || status
}

/**
 * 状态对应的tag类型
 */
function getStatusType(status: Accrual['status']): 'primary' | 'success' | 'warning' | 'info' {
  const map: Record<Accrual['status'], 'primary' | 'success' | 'warning' | 'info'> = {
    generated: 'primary',
    printed: 'success',
  }
  return map[status] || 'info'
}

/**
 * 计提方式文本
 */
function getMethodText(method: Accrual['method']): string {
  const map: Record<Accrual['method'], string> = {
    detail: '按明细表',
    invoice: '按发票',
    allocation: '按费用分摊',
  }
  return map[method] || method
}

export function useAccrualData() {
  return {
    accrualList,
    loading,
    fetchAccruals,
    fetchAccrualById,
    generateAccrual,
    deleteAccrual,
    deleteAccruals,
    updateAccrualStatus,
    updateAccrual,
    getAccrualById,
    getAccrualByBatchId,
    getStatusText,
    getStatusType,
    getMethodText,
  }
}
