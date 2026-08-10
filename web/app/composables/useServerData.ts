/**
 * 服务器管理数据源（本地 + 云 + 物理机/虚拟机）
 * 数据来自后端 API，全局单例共享；列表为分页响应 { list, total, page, pageSize }。
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import { shouldSilenceStaleFailure } from '~/utils/server-workspace-sync'
import type {
  ServerItem, ServerListItem, ServerListResponse, ServerDetail, ServerQueryParams,
} from '~/types/server'
export type { ServerItem, ServerListItem, ServerListResponse, ServerDetail, ServerQueryParams }

// ====== 常量 ======

/** 预设服务器类型（allow-create 可自定义） */
export const serverTypeOptions = [
  { value: '本地', label: '本地' },
  { value: '阿里云', label: '阿里云' },
  { value: '腾讯云', label: '腾讯云' },
  { value: '华为云', label: '华为云' },
]

/** 预设类型 → el-tag type 映射 */
export const serverTypeTagMap: Record<string, string> = {
  '本地': 'info',
  '阿里云': 'warning',
  '腾讯云': 'success',
  '华为云': 'danger',
}

/** 自定义类型配色池（el-tag color 需 hex） */
export const customColorPalette = ['#6C5CE7', '#00B894', '#0984E3', '#FD79A8', '#636E72', '#00CEC9']
export const customTypeColors = ref<Record<string, string>>({})

/** 服务器类型标签属性 */
export function getServerTypeTagAttrs(type: string): Record<string, any> {
  if (serverTypeTagMap[type]) return { type: serverTypeTagMap[type] }
  if (customTypeColors.value[type]) return { color: customTypeColors.value[type], effect: 'light' }
  return { type: 'info' }
}

/** 自定义类型颜色分配 */
export function assignCustomTypeColor(type: string) {
  if (serverTypeTagMap[type] || customTypeColors.value[type]) return
  const usedColors = new Set(Object.values(customTypeColors.value))
  const available = customColorPalette.find(c => !usedColors.has(c))
  if (available) customTypeColors.value[type] = available
}

/** 状态枚举（与后端一致：正常/停用/报废） */
export const serverStatusOptions = ['正常', '停用', '报废']

/** 虚拟化平台枚举（空=无） */
export const hypervisorOptions = ['PVE', 'ESXi']

/** 硬盘类型选项 */
export const diskTypeOptions = ['SSD', 'HDD', 'SSD+HDD']

/** 资产状态 → el-tag type（全局统一） */
export function getStatusTagType(status: string): 'success' | 'info' | 'danger' {
  if (status === '正常') return 'success'
  if (status === '报废') return 'danger'
  return 'info'
}

// ====== 单例状态 ======

const serverList = ref<ServerListItem[]>([])
/** 列表请求错误信息（空=成功或未请求） */
const listError = ref('')
/** 全量服务器（树形"全部"视图，不含密码，不分页） */
const serverTree = ref<ServerListItem[]>([])
const treeLoading = ref(false)
/** 树请求错误信息（空=成功或未请求） */
const treeError = ref('')
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
/** 全量统计（stats 接口，不受分页/筛选影响；口径：仅 status=正常） */
const physicalCount = ref(0)
const virtualCount = ref(0)
const expiringSoonCount = ref(0)
const warrantyExpiringCount = ref(0)
/** 统计接口状态：加载中/未加载/失败均视为"不可用"，页面显示 "--" 而非业务含义的假 0 */
const statsLoading = ref(false)
const statsLoaded = ref(false)
const statsError = ref('')
/** 统计是否可用（仅成功加载后才为 false，可显示真实数字） */
const statsUnavailable = computed(() => statsLoading.value || !statsLoaded.value || Boolean(statsError.value))
/** 物理机列表（供"虚拟机选宿主"下拉与筛选） */
const hostOptions = ref<{ id: number; name: string; internalIp: string; hypervisor: string | null }[]>([])
/** 请求序号：防止快速切换筛选/分页时旧响应覆盖新响应 */
let requestSeq = 0

// ====== API 调用 ======

/** 拉取服务器分页列表；参数变化（筛选/分页）走统一入口 */
async function fetchServers(params: ServerQueryParams = {}) {
  const seq = ++requestSeq
  loading.value = true
  try {
    const { get } = useApi()
    const query: Record<string, any> = {
      page: params.page ?? page.value,
      pageSize: params.pageSize ?? pageSize.value,
    }
    if (params.keyword) query.keyword = params.keyword
    if (params.status) query.status = params.status
    if (params.isVirtual !== undefined) query.isVirtual = params.isVirtual ? '1' : '0'
    if (params.hypervisor) query.hypervisor = params.hypervisor
    if (params.hostServerId) query.hostServerId = params.hostServerId
    if (params.serverType) query.serverType = params.serverType

    const data = await get<ServerListResponse>('/api/servers', { query })
    if (seq !== requestSeq) return // 已有更新的请求，丢弃本次结果
    listError.value = '' // 成功时清空错误
    serverList.value = data.list
    total.value = data.total
    page.value = data.page
    pageSize.value = data.pageSize
  } catch (error) {
    if (seq === requestSeq) {
      listError.value = getApiErrorMessage(error)
      ElMessage.error(listError.value)
    }
  } finally {
    if (seq === requestSeq) loading.value = false
  }
}

/** 拉取服务器详情（物理机→含虚拟机列表；虚拟机→含宿主信息） */
async function fetchServerDetail(id: number): Promise<ServerDetail | null> {
  try {
    const { get } = useApi()
    return await get<ServerDetail>(`/api/servers/${id}`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
    return null
  }
}

/** 全量统计（stats 接口：物理机/虚拟机/即将到期，口径 status=正常） */
async function fetchServerStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    const { get } = useApi()
    const data = await get<{
      physicalCount: number; virtualCount: number
      expiringSoonCount: number; warrantyExpiringCount: number
    }>('/api/servers/stats')
    physicalCount.value = data.physicalCount
    virtualCount.value = data.virtualCount
    expiringSoonCount.value = data.expiringSoonCount
    warrantyExpiringCount.value = data.warrantyExpiringCount
    statsLoaded.value = true
  } catch (error) {
    // 失败时保留初始值但标记错误，页面显示 "--" 而非有业务含义的假 0
    statsLoaded.value = false
    statsError.value = getApiErrorMessage(error)
  } finally {
    statsLoading.value = false
  }
}

/** 拉取物理机列表（专用 hosts 接口，全量不分页；供"虚拟机选宿主"下拉） */
/** 宿主下拉请求错误信息 */
const hostsError = ref('')
async function fetchPhysicalHosts() {
  try {
    const { get } = useApi()
    hostOptions.value = await get<{ id: number; name: string; internalIp: string; hypervisor: string | null }[]>('/api/servers/hosts')
    hostsError.value = ''
  } catch (e) {
    hostOptions.value = []
    hostsError.value = e instanceof Error ? e.message : String(e)
  }
}

/** 新增服务器（不含密码字段） */
async function addServer(data: Record<string, any>) {
  const { post } = useApi()
  await post('/api/servers', data)
}

/** 编辑服务器（不含密码字段；密码留空=保持） */
async function updateServer(id: number, data: Record<string, any>) {
  const { put } = useApi()
  await put(`/api/servers/${id}`, data)
}

/** 删除服务器（后端对仍有虚拟机的宿主返回 409） */
async function deleteServer(id: number) {
  const { delete: del } = useApi()
  await del(`/api/servers/${id}`)
}

/** 查看服务器密码（独立接口，仅管理员/操作员） */
async function fetchServerPassword(id: number): Promise<{ password: string; dbPassword: string }> {
  const { post } = useApi()
  return await post<{ password: string; dbPassword: string }>(`/api/servers/${id}/password`, { action: 'view' })
}

/** 更新服务器密码（独立接口，仅管理员/操作员） */
async function updateServerPassword(id: number, data: { password?: string; dbPassword?: string }) {
  const { post } = useApi()
  await post(`/api/servers/${id}/password`, { action: 'update', ...data })
}

// ====== 纯前端计算 ======

/** 计算距到期天数（负数=已过期，空=无到期日） */
export function getExpireDays(date: string | null): number | null {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expire = new Date(`${date}T00:00:00`) // 避免时区偏移
  if (Number.isNaN(expire.getTime())) return null
  return Math.floor((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** 拉取全量服务器（树形/卡片"全部"视图用；独立 treeSeq，避免与列表请求的 requestSeq 竞争导致 loading 卡死） */
let treeSeq = 0
async function fetchServerTree() {
  const seq = ++treeSeq
  treeLoading.value = true
  treeError.value = ''
  try {
    const { get } = useApi()
    const res = await get<ServerListItem[]>('/api/servers/tree')
    if (seq === treeSeq) serverTree.value = res
  } catch (e) {
    // 过期请求失败：静默丢弃，不写 error/loading/tree，不向 refreshWorkspace 抛出
    if (shouldSilenceStaleFailure(seq, treeSeq)) return
    // 当前 seq 失败：设置 treeError 并向上抛出，让 refreshWorkspace 能检测到失败
    treeError.value = e instanceof Error ? e.message : String(e)
    throw e
  } finally {
    if (seq === treeSeq) treeLoading.value = false
  }
}

export function useServerData() {
  return {
    serverList, listError, serverTree, treeLoading, treeError, total, page, pageSize, loading, physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount, hostOptions, hostsError,
    statsLoading, statsLoaded, statsError, statsUnavailable,
    serverTypeOptions, serverTypeTagMap, customTypeColors, customColorPalette,
    serverStatusOptions, hypervisorOptions, diskTypeOptions,
    getServerTypeTagAttrs, assignCustomTypeColor, getStatusTagType,
    getExpireDays,
    fetchServers, fetchServerStats, fetchServerDetail, fetchServerTree, fetchPhysicalHosts,
    addServer, updateServer, deleteServer, fetchServerPassword, updateServerPassword,
  }
}
