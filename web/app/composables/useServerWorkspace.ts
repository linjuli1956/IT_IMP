/**
 * 服务器管理工作区 composable（页面级）。
 *
 * 职责：
 * - query：唯一筛选、Tab、页码状态（页面级，非模块级全局单例）
 * - refreshWorkspace()：唯一写操作后刷新入口
 * - 当前列表、全量树、统计、宿主下拉的刷新协调
 * - 明确处理 tree/list/stats/hosts 任一失败
 *
 * useServerData 只保留 API 请求与数据状态。
 */
import { ElMessage } from 'element-plus'
import { useServerData } from './useServerData'
import { hasRefreshFailure, tabToIsVirtual } from '~/utils/server-workspace-sync'
import type { ServerQueryParams } from '~/types/server'

export interface ServerWorkspaceQuery {
  keyword: string
  status: string
  hypervisor: string
  hostServerId: number | undefined
  activeTab: 'all' | 'physical' | 'virtual'
  page: number
  pageSize: number
}

export function useServerWorkspace() {
  const {
    serverList, listError,
    serverTree, treeLoading, treeError,
    total, page, pageSize, loading,
    physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount,
    hostOptions, hostsError,
    statsLoading, statsLoaded, statsError, statsUnavailable,
    fetchServers, fetchServerTree, fetchServerStats, fetchPhysicalHosts,
    serverTypeOptions, serverTypeTagMap, customTypeColors, customColorPalette,
    serverStatusOptions, hypervisorOptions, diskTypeOptions,
    getServerTypeTagAttrs, assignCustomTypeColor, getStatusTagType, getExpireDays,
    fetchServerDetail, addServer, updateServer, deleteServer,
    fetchServerPassword, updateServerPassword,
  } = useServerData()

  /** 工作区 query 状态（页面级，每次调用创建新实例） */
  const query = reactive<ServerWorkspaceQuery>({
    keyword: '',
    status: '',
    hypervisor: '',
    hostServerId: undefined,
    activeTab: 'all',
    page: 1,
    pageSize: 20,
  })

  /** 刷新失败状态（true=最近一次刷新有任一数据源失败） */
  const workspaceRefreshError = ref(false)

  /**
   * 从 query 状态派生标准化查询参数。
   * 全部 Tab 不传 isVirtual；物理机 Tab 传 false；虚拟机 Tab 传 true。
   */
  function buildQuery(): ServerQueryParams {
    return {
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      hypervisor: query.hypervisor || undefined,
      hostServerId: query.hostServerId,
      isVirtual: tabToIsVirtual(query.activeTab),
      page: query.page,
      pageSize: query.pageSize,
    }
  }

  /** 重置 query 到初始状态 */
  function resetQuery() {
    query.keyword = ''
    query.status = ''
    query.hypervisor = ''
    query.hostServerId = undefined
    query.activeTab = 'all'
    query.page = 1
    query.pageSize = 20
  }

  /**
   * 统一刷新入口：所有写操作（新增/编辑/删除/批量删除）成功后只能调用此函数。
   *
   * 刷新 list、tree、stats、hosts 四个数据源，明确处理任一失败：
   * - fetchServerTree 会 re-throw → Promise.allSettled 检测为 rejected
   * - fetchServers / fetchServerStats / fetchPhysicalHosts 内部 catch 但设置 error 状态 → 检查状态
   *
   * 失败时提示"数据同步失败，请重试"，不显示"已同步"假象。
   */
  async function refreshWorkspace(): Promise<boolean> {
    workspaceRefreshError.value = false
    const q = buildQuery()

    // 重置错误状态（在各自 fetch 函数内部也会重置）
    listError.value = ''
    treeError.value = ''
    statsError.value = ''
    hostsError.value = ''

    // allSettled：不因一个失败而短路其他刷新
    const results = await Promise.allSettled([
      fetchServers(q),
      fetchServerTree(),
      fetchServerStats(),
      fetchPhysicalHosts(),
    ])

    // 检查是否有失败
    const failed = hasRefreshFailure(results, {
      treeError: treeError.value, listError: listError.value,
      statsError: statsError.value, hostsError: hostsError.value,
    })

    if (failed) {
      workspaceRefreshError.value = true
      ElMessage.error('数据同步失败，请刷新后确认')
      return false
    }

    return true
  }

  return {
    // query 状态
    query,
    resetQuery,
    buildQuery,
    // 错误状态
    treeError,
    workspaceRefreshError,
    // 数据状态（从 useServerData 透传）
    serverList, serverTree, treeLoading, total, page, pageSize, loading,
    physicalCount, virtualCount, expiringSoonCount, warrantyExpiringCount,
    hostOptions, statsLoading, statsLoaded, statsError, statsUnavailable,
    // 刷新入口
    refreshWorkspace,
    // API 函数（从 useServerData 透传）
    fetchServers, fetchServerTree, fetchServerStats, fetchPhysicalHosts,
    fetchServerDetail, addServer, updateServer, deleteServer,
    fetchServerPassword, updateServerPassword,
    // 常量与工具函数（从 useServerData 透传）
    serverTypeOptions, serverTypeTagMap, customTypeColors, customColorPalette,
    serverStatusOptions, hypervisorOptions, diskTypeOptions,
    getServerTypeTagAttrs, assignCustomTypeColor, getStatusTagType, getExpireDays,
  }
}
