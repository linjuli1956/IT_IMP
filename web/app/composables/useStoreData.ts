/**
 * 门店/部门/机构 共享数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { StoreItem } from '~/types/store'
export type { StoreItem }

// 全局共享的门店列表（单例）
const storeList = ref<StoreItem[]>([])
const loading = ref(false)

async function fetchStores() {
  loading.value = true
  try {
    const { get } = useApi()
    storeList.value = await get<StoreItem[]>('/api/stores')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addStore(data: { name: string; code?: string; sort?: number }) {
  const { post } = useApi()
  await post('/api/stores', data)
  await fetchStores()
}

async function updateStore(id: number, data: Partial<StoreItem>) {
  const { put } = useApi()
  await put(`/api/stores/${id}`, data)
  await fetchStores()
}

async function deleteStore(id: number) {
  const { delete: del } = useApi()
  await del(`/api/stores/${id}`)
  await fetchStores()
}

async function toggleStatus(id: number) {
  const item = storeList.value.find(s => s.id === id)
  if (item) {
    await updateStore(id, { status: item.status === 1 ? 0 : 1 })
  }
}

/**
 * 获取门店列表（响应式）
 */
export function useStoreData() {
  /**
   * 获取所有启用的门店名称列表（用于下拉选项）
   */
  const storeOptions = computed(() =>
    storeList.value
      .filter(s => s.status === 1)
      .map(s => ({ label: s.name, value: s.name }))
  )

  /** 所有启用门店的名称列表（用于筛选/校验等场景） */
  const storeNames = computed(() =>
    storeList.value
      .filter(s => s.status === 1)
      .map(s => s.name)
  )

  /**
   * 根据名称查找门店
   */
  function findByName(name: string): StoreItem | undefined {
    return storeList.value.find(s => s.name === name)
  }

  return {
    storeList,
    loading,
    storeOptions,
    storeNames,
    findByName,
    fetchStores,
    addStore,
    updateStore,
    deleteStore,
    toggleStatus,
  }
}
