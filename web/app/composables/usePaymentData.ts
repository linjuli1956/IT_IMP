/**
 * 支付管理数据源
 * 数据来自后端 API，全局单例共享
 * 支付配置：门店级支付方式配置项（商户号/密钥/APPID等）
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { PaymentConfigItem } from '~/types/payment'
export type { PaymentConfigItem }

// ====== 常量 ======

export const payMethodOptions = [
  { value: 'wx', label: '微信', tagType: 'success' },
  { value: 'zfb', label: '支付宝', tagType: 'primary' },
  { value: 'yl', label: '银联', tagType: 'danger' },
  { value: 'yzf', label: '翼支付', tagType: 'warning' },
]

export const payMethodMap: Record<string, { name: string; tagType: string }> = {
  wx: { name: '微信', tagType: 'success' },
  zfb: { name: '支付宝', tagType: 'primary' },
  yl: { name: '银联', tagType: 'danger' },
  yzf: { name: '翼支付', tagType: 'warning' },
}

export const providerOptions = ['中国邮政', '昂捷', '昂捷离线付']

const paymentStatusOptions = ['正常', '停用']

// 判断是否敏感字段
export function isSensitiveField(configName: string): boolean {
  const keywords = ['密钥', '秘钥', '退款密码', '密码']
  return keywords.some(k => configName.includes(k))
}

// ====== 单例状态 ======

const configItems = ref<PaymentConfigItem[]>([])
const loading = ref(false)

// ====== 配置项 CRUD ======

async function fetchConfigItems() {
  loading.value = true
  try {
    const { get } = useApi()
    configItems.value = await get<PaymentConfigItem[]>('/api/payments')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addConfigItem(data: Omit<PaymentConfigItem, 'id'>) {
  const { post } = useApi()
  await post('/api/payments', data)
  await fetchConfigItems()
}

async function updateConfigItem(id: number, data: Partial<PaymentConfigItem>) {
  const { put } = useApi()
  await put(`/api/payments/${id}`, data)
  await fetchConfigItems()
}

async function deleteConfigItem(id: number) {
  const { delete: del } = useApi()
  await del(`/api/payments/${id}`)
  await fetchConfigItems()
}

// ====== 导出 ======

export function usePaymentData() {
  return {
    configItems,
    loading,
    payMethodOptions,
    payMethodMap,
    providerOptions,
    paymentStatusOptions,
    isSensitiveField,
    fetchConfigItems,
    addConfigItem,
    updateConfigItem,
    deleteConfigItem,
  }
}
