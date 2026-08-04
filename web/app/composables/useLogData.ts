/**
 * 操作日志数据源
 * 数据来自后端 API，全局单例共享
 * 参照 useStoreData.ts 模式：全局单例 + useApi() + loading ref + try/catch + getApiErrorMessage
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage, ElMessageBox } from 'element-plus'

/** 操作日志记录类型 */
export interface OperationLog {
  id: number
  time: string
  username: string
  action: string
  module: string
  content: string
  ip: string
}

/** 日志查询参数 */
export interface LogQueryParams {
  startDate?: string
  endDate?: string
  username?: string
  action?: string
  module?: string
  page?: number
  pageSize?: number
}

// 全局共享（单例）
const logList = ref<OperationLog[]>([])
const loading = ref(false)
const total = ref(0)

/**
 * 获取操作日志列表
 * @param params 筛选条件（可选）
 */
async function fetchLogs(params?: LogQueryParams) {
  loading.value = true
  try {
    const { get } = useApi()
    const data = await get<{ list: any[]; total: number }>('/api/logs', {
      query: params,
    })
    // 字段映射：API 返回的 createdAt → 前端 time
    logList.value = data.list.map(item => ({
      id: item.id,
      time: item.createdAt,
      username: item.username,
      action: item.action,
      module: item.module,
      content: item.content,
      ip: item.ip,
    }))
    total.value = data.total
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

/**
 * 清除全部操作日志（需管理员权限）
 */
async function clearLogs() {
  try {
    await ElMessageBox.confirm('确定要清空全部操作日志吗？此操作不可恢复。', '清除日志', {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }

  loading.value = true
  try {
    const { delete: del } = useApi()
    await del('/api/logs')
    ElMessage.success('操作日志已清空')
    await fetchLogs()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

export function useLogData() {
  return {
    logList,
    loading,
    total,
    fetchLogs,
    clearLogs,
  }
}
