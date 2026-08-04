/**
 * 合同管理 共享数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { Contract } from '~/types/contract'
export type { Contract }

// 合同类型选项
export const contractTypes = ['宽带', '设备采购', '项目', '采购', '维保']

// 全局共享的合同列表（单例）
const contractList = ref<Contract[]>([])
const loading = ref(false)

/**
 * 计算合同到期状态
 * @returns 'expired' | 'expiring' | 'active'
 */
export function getContractStatus(expireDate: string): 'expired' | 'expiring' | 'active' {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expire = new Date(expireDate)
  const diffDays = Math.floor((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 30) return 'expiring'
  return 'active'
}

/**
 * 计算剩余天数
 */
export function getDaysLeft(expireDate: string): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expire = new Date(expireDate)
  return Math.floor((expire.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

async function fetchContracts() {
  loading.value = true
  try {
    const { get } = useApi()
    contractList.value = await get<Contract[]>('/api/contracts')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addContract(data: Omit<Contract, 'id'>) {
  const { post } = useApi()
  await post('/api/contracts', data)
  await fetchContracts()
}

async function updateContract(id: number, data: Partial<Contract>) {
  const { put } = useApi()
  await put(`/api/contracts/${id}`, data)
  await fetchContracts()
}

async function deleteContract(id: number) {
  const { delete: del } = useApi()
  await del(`/api/contracts/${id}`)
  await fetchContracts()
}

/**
 * 即将到期的合同列表（30天内）
 */
const expiringContracts = computed(() =>
  contractList.value.filter(c => getContractStatus(c.expireDate) === 'expiring')
)

/**
 * 已过期的合同列表
 */
const expiredContracts = computed(() =>
  contractList.value.filter(c => getContractStatus(c.expireDate) === 'expired')
)

export function useContractData() {
  return {
    contractList,
    loading,
    contractTypes,
    fetchContracts,
    addContract,
    updateContract,
    deleteContract,
    expiringContracts,
    expiredContracts,
  }
}
