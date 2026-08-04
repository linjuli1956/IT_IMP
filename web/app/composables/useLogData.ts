/** 操作日志数据源：全局状态、筛选项与 API 请求。 */
import { ElMessage, ElMessageBox } from 'element-plus'
import { getApiErrorMessage, useApi } from './useApi'

export interface OperationLog {
  id: number
  time: string
  username: string
  action: string
  module: string
  content: string
  ip: string
}

export interface LogQueryParams {
  startDate?: string
  endDate?: string
  username?: string
  action?: string
  module?: string
  page?: number
  pageSize?: number
}

export interface LogFilters {
  dateRange: [string, string] | null
  username: string
  action: string
  module: string
}

export interface LogFilterOptions {
  usernames: string[]
  actions: string[]
  modules: string[]
}

const logList = ref<OperationLog[]>([])
const loading = shallowRef(false)
const total = shallowRef(0)
const filterOptions = ref<LogFilterOptions>({ usernames: [], actions: [], modules: [] })

async function fetchLogs(params: LogQueryParams = {}) {
  loading.value = true
  try {
    const { get } = useApi()
    const data = await get<{ list: Array<Omit<OperationLog, 'time'> & { createdAt: string }>; total: number }>('/api/logs', {
      query: params,
    })
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

async function fetchLogOptions() {
  try {
    const { get } = useApi()
    filterOptions.value = await get<LogFilterOptions>('/api/logs/options')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

async function clearLogs(): Promise<boolean> {
  try {
    await ElMessageBox.confirm('确定要清空全部操作日志吗？此操作不可恢复。', '清除日志', {
      confirmButtonText: '确定清空',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return false
  }

  loading.value = true
  try {
    const { delete: del } = useApi()
    await del('/api/logs')
    ElMessage.success('操作日志已清空，并保留了本次清空记录')
    return true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return false
  } finally {
    loading.value = false
  }
}

export function useLogData() {
  return {
    logList,
    loading,
    total,
    filterOptions,
    fetchLogs,
    fetchLogOptions,
    clearLogs,
  }
}
