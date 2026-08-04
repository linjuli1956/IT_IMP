/**
 * 客户/供应商管理数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'

export interface SupplierItem {
  id: number
  name: string
  contact: string
  phone: string
  address: string
  type: string
  remark: string
}

// 全局共享的客户列表（单例）
const supplierList = ref<SupplierItem[]>([])
const loading = ref(false)

async function fetchSuppliers() {
  loading.value = true
  try {
    const { get } = useApi()
    supplierList.value = await get<SupplierItem[]>('/api/suppliers')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addSupplier(data: Omit<SupplierItem, 'id'>) {
  const { post } = useApi()
  await post('/api/suppliers', data)
  await fetchSuppliers()
}

async function updateSupplier(id: number, data: Partial<SupplierItem>) {
  const { put } = useApi()
  await put(`/api/suppliers/${id}`, data)
  await fetchSuppliers()
}

async function deleteSupplier(id: number) {
  const { delete: del } = useApi()
  await del(`/api/suppliers/${id}`)
  await fetchSuppliers()
}

export function useSupplierData() {
  return {
    supplierList,
    loading,
    fetchSuppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
  }
}
