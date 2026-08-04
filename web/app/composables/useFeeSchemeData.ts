/**
 * 费用分摊方案 共享数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useTemplateData.ts 模式
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { FeeItem, FeeAllocationScheme } from '~/types/fee-scheme'
export type { FeeItem, FeeAllocationScheme }

// 全局共享（单例）
const schemeList = ref<FeeAllocationScheme[]>([])
const loading = ref(false)

/** 查询参数 */
export interface FeeSchemeQueryParams {
  carrier?: string
  status?: number
}

/**
 * 获取费用分摊方案列表
 * @param params 筛选条件（可选）
 */
async function fetchFeeSchemes(params?: FeeSchemeQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    schemeList.value = await get<FeeAllocationScheme[]>('/api/fee-schemes', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 获取方案详情（含 items JSON 数据）
 * @param id 方案ID
 */
async function fetchSchemeById(id: number): Promise<FeeAllocationScheme | null> {
  try {
    const { get } = useApi()
    return await get<FeeAllocationScheme>(`/api/fee-schemes/${id}`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 新增费用分摊方案
 * @param data 方案数据
 * @returns 创建成功返回方案，失败返回 null
 */
async function createFeeScheme(data: {
  name: string
  carrier?: string
  items?: FeeItem[]
  reimbursementFormat?: string
  reimbursementCustom?: string
  status?: number
}): Promise<FeeAllocationScheme | null> {
  try {
    const { post } = useApi()
    const result = await post<FeeAllocationScheme>('/api/fee-schemes', data)
    schemeList.value.push(result)
    return result
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 更新费用分摊方案
 * @param id 方案ID
 * @param data 更新字段（部分更新）
 * @returns 成功返回 true，失败返回 false
 */
async function updateFeeScheme(id: number, data: {
  name?: string
  carrier?: string
  items?: FeeItem[]
  reimbursementFormat?: string
  reimbursementCustom?: string
  status?: number
}): Promise<boolean> {
  try {
    const { put } = useApi()
    const result = await put<FeeAllocationScheme>(`/api/fee-schemes/${id}`, data)
    const idx = schemeList.value.findIndex(s => s.id === id)
    if (idx > -1) {
      schemeList.value[idx] = result
    }
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  }
}

/**
 * 删除费用分摊方案
 * @param id 方案ID
 * @returns 成功返回 true，失败返回 false
 */
async function deleteFeeScheme(id: number): Promise<boolean> {
  try {
    const { delete: del } = useApi()
    await del(`/api/fee-schemes/${id}`)
    const idx = schemeList.value.findIndex(s => s.id === id)
    if (idx > -1) {
      schemeList.value.splice(idx, 1)
    }
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  }
}

export function useFeeSchemeData() {
  /**
   * 根据运营商查找可用方案（含通用方案）
   * 通用方案（carrier 为空）所有运营商可复用
   */
  function findByCarrier(carrier: string): FeeAllocationScheme[] {
    return schemeList.value.filter(s =>
      (s.carrier === carrier || s.carrier === '') && s.status === 1
    )
  }

  /**
   * 根据ID查找方案（同步，从内存列表查找）
   */
  function getById(id: number): FeeAllocationScheme | undefined {
    return schemeList.value.find(s => s.id === id)
  }

  return {
    schemeList,
    loading,
    fetchFeeSchemes,
    fetchSchemeById,
    createFeeScheme,
    updateFeeScheme,
    deleteFeeScheme,
    findByCarrier,
    getById,
  }
}
