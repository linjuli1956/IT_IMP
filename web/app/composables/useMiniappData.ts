/**
 * 小程序管理数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { MiniappItem } from '~/types/miniapp'
export type { MiniappItem }

// ====== 常量（纯前端配置）======

const miniappStatusOptions = ['正常', '停用']

// ====== 单例状态 ======

const miniappList = ref<MiniappItem[]>([])
const loading = ref(false)

// ====== API 调用 ======

async function fetchMiniapps() {
  loading.value = true
  try {
    const { get } = useApi()
    miniappList.value = await get<MiniappItem[]>('/api/miniapps')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addMiniapp(data: Omit<MiniappItem, 'id'>) {
  const { post } = useApi()
  await post('/api/miniapps', data)
  await fetchMiniapps()
}

async function updateMiniapp(id: number, data: Partial<MiniappItem>) {
  const { put } = useApi()
  await put(`/api/miniapps/${id}`, data)
  await fetchMiniapps()
}

async function deleteMiniapp(id: number) {
  const { delete: del } = useApi()
  await del(`/api/miniapps/${id}`)
  await fetchMiniapps()
}

// ====== 导出 ======

export function useMiniappData() {
  return {
    miniappList,
    loading,
    miniappStatusOptions,
    fetchMiniapps,
    addMiniapp,
    updateMiniapp,
    deleteMiniapp,
  }
}
