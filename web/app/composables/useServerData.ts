/**
 * 服务器管理数据源（本地 + 阿里云/腾讯云/华为云/自定义）
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import type { ServerItem } from '~/types/server'
export type { ServerItem }

// ====== 常量（纯前端配置）======

// 预设服务器类型（用户可通过 allow-create 自定义新类型）
export const serverTypeOptions = [
  { value: '本地', label: '本地' },
  { value: '阿里云', label: '阿里云' },
  { value: '腾讯云', label: '腾讯云' },
  { value: '华为云', label: '华为云' },
]

// 预设类型 → el-tag type 映射
export const serverTypeTagMap: Record<string, string> = {
  '本地': 'info',
  '阿里云': 'warning',
  '腾讯云': 'success',
  '华为云': 'danger',
}

// 自定义类型配色池（el-tag color 属性需 hex 值，不支持 CSS 变量；用于用户自定义服务器类型）
export const customColorPalette = ['#6C5CE7', '#00B894', '#0984E3', '#FD79A8', '#636E72', '#00CEC9']
export const customTypeColors = ref<Record<string, string>>({})

// 获取服务器类型标签属性（预设用 tagType，自定义用 color）
export function getServerTypeTagAttrs(type: string): Record<string, any> {
  if (serverTypeTagMap[type]) return { type: serverTypeTagMap[type] }
  if (customTypeColors.value[type]) return { color: customTypeColors.value[type], effect: 'light' }
  return { type: 'info' }
}

// 自定义类型颜色分配
export function assignCustomTypeColor(type: string) {
  if (serverTypeTagMap[type] || customTypeColors.value[type]) return
  const usedColors = new Set(Object.values(customTypeColors.value))
  const available = customColorPalette.find(c => !usedColors.has(c))
  if (available) {
    customTypeColors.value[type] = available
  }
}

const serverStatusOptions = ['正常', '停用']

/** 硬盘类型选项 */
export const diskTypeOptions = ['SSD', 'HDD', 'SSD+HDD']

// ====== 单例状态 ======

const serverList = ref<ServerItem[]>([])
const loading = ref(false)

// ====== API 调用 ======

async function fetchServers() {
  loading.value = true
  try {
    const { get } = useApi()
    serverList.value = await get<ServerItem[]>('/api/servers')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function addServer(data: Omit<ServerItem, 'id'>) {
  const { post } = useApi()
  await post('/api/servers', data)
  await fetchServers()
}

async function updateServer(id: number, data: Partial<ServerItem>) {
  const { put } = useApi()
  await put(`/api/servers/${id}`, data)
  await fetchServers()
}

async function deleteServer(id: number) {
  const { delete: del } = useApi()
  await del(`/api/servers/${id}`)
  await fetchServers()
}

// ====== 纯前端计算 ======

/** 计算距到期天数（负数=已过期，空=无到期日） */
export function getExpireDays(expireDate: string): number | null {
  if (!expireDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expire = new Date(expireDate)
  expire.setHours(0, 0, 0, 0)
  return Math.floor((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export function useServerData() {
  /** 即将到期服务器数（30天内） */
  const expiringSoonCount = computed(() =>
    serverList.value.filter(s => {
      const days = getExpireDays(s.expireDate)
      return days !== null && days >= 0 && days <= 30
    }).length
  )

  return {
    serverList,
    loading,
    serverTypeOptions,
    serverTypeTagMap,
    customTypeColors,
    serverStatusOptions,
    diskTypeOptions,
    getServerTypeTagAttrs,
    assignCustomTypeColor,
    getExpireDays,
    expiringSoonCount,
    fetchServers,
    addServer,
    updateServer,
    deleteServer,
  }
}
