/**
 * 明细表 共享数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useStoreData.ts 模式：全局单例 + useApi() + loading ref + try/catch + getApiErrorMessage
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { DetailTable, DetailSheet } from '~/types/detail'
export type { DetailTable, DetailSheet }

// 全局共享（单例）
const detailList = ref<DetailTable[]>([])
const loading = ref(false)

/** 查询参数 */
export interface DetailQueryParams {
  carrier?: string
  feeMonth?: string
}

/**
 * 获取明细表列表
 * @param params 筛选条件（可选）
 */
async function fetchDetails(params?: DetailQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    detailList.value = await get<DetailTable[]>('/api/details', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 获取明细表详情（含 sheets JSON 数据）
 * @param id 明细表ID
 */
async function fetchDetailById(id: number): Promise<DetailTable | null> {
  try {
    const { get } = useApi()
    return await get<DetailTable>(`/api/details/${id}`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 上传明细表（multipart/form-data）
 * @param formData 包含 file, carrier, feeMonth 的 FormData
 * @returns 创建的明细表记录，失败返回 null
 */
async function uploadDetail(formData: FormData): Promise<DetailTable | null> {
  try {
    const { post } = useApi()
    const data = await post<DetailTable>('/api/details', formData)
    // 将新数据添加到列表头部
    detailList.value.unshift(data)
    return data
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/**
 * 删除明细表
 * @param id 明细表ID
 */
async function deleteDetail(id: number) {
  try {
    const { delete: del } = useApi()
    await del(`/api/details/${id}`)
    // 从列表中移除
    const idx = detailList.value.findIndex(d => d.id === id)
    if (idx > -1) {
      detailList.value.splice(idx, 1)
    }
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

/**
 * 根据 ID 获取明细表（同步，从内存列表查找）
 * 注意：需先调用 fetchDetails() 加载数据
 */
function getDetailById(id: number): DetailTable | undefined {
  return detailList.value.find(d => d.id === id)
}

/**
 * 根据运营商+费用月查找明细表（同步，从内存列表查找）
 * 注意：需先调用 fetchDetails() 加载数据
 */
function findByCarrierMonth(carrier: string, feeMonth: string): DetailTable | undefined {
  return detailList.value.find(d => d.carrier === carrier && d.feeMonth === feeMonth)
}

export function useDetailData() {
  return {
    detailList,
    loading,
    fetchDetails,
    fetchDetailById,
    uploadDetail,
    deleteDetail,
    getDetailById,
    findByCarrierMonth,
  }
}
