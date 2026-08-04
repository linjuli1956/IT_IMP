/**
 * 域名管理数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { DomainItem } from '~/types/domain'
export type { DomainItem }

// ====== 常量（纯前端配置）======

// 证书类型选项
export const certTypeOptions = [
  { value: 'DV', label: 'DV（域名型）' },
  { value: 'OV', label: 'OV（企业型）' },
  { value: 'EV', label: 'EV（增强型）' },
]

// 证书类型 → el-tag type 映射
export const certTypeTagMap: Record<string, string> = {
  'DV': 'info',
  'OV': 'warning',
  'EV': 'danger',
}

const domainStatusOptions = ['正常', '停用']

// ====== 单例状态 ======

const domainList = ref<DomainItem[]>([])
const loading = ref(false)

// ====== API 调用 ======

async function fetchDomains() {
  loading.value = true
  try {
    const { get } = useApi()
    domainList.value = await get<DomainItem[]>('/api/domains')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addDomain(data: Omit<DomainItem, 'id'>) {
  const { post } = useApi()
  await post('/api/domains', data)
  await fetchDomains()
}

async function updateDomain(id: number, data: Partial<DomainItem>) {
  const { put } = useApi()
  await put(`/api/domains/${id}`, data)
  await fetchDomains()
}

async function deleteDomain(id: number) {
  const { delete: del } = useApi()
  await del(`/api/domains/${id}`)
  await fetchDomains()
}

// ====== 导出 ======

export function useDomainData() {
  return {
    domainList,
    loading,
    certTypeOptions,
    certTypeTagMap,
    domainStatusOptions,
    fetchDomains,
    addDomain,
    updateDomain,
    deleteDomain,
  }
}
