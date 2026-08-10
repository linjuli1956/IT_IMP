/**
 * 服务器悬停预览数据纯函数（供 RecordPreviewTooltip 使用）。
 * 纯函数、强类型、无 API 请求、不含密码/账号等敏感字段。
 *
 * 宿主名称 hover：只展示物理机自身信息（不塞 VM 列表）。
 * VM 摘要区 hover：展示 VM 列表（名称/IP/用途/状态，最多 6 台）。
 * 管理地址在预览中只显示"已配置"/"未配置"，不展示完整 URL。
 */
import type { ServerListItem } from '~/types/server'

/** 预览行（与 RecordPreviewTooltip 的 PreviewRow 结构兼容） */
export interface ServerPreviewRow {
  label: string
  value: unknown
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

/** 拼接非空项，全空返回 null */
function joinParts(...parts: (string | null | undefined)[]): string | null {
  const filtered = parts.filter(Boolean)
  return filtered.length > 0 ? filtered.join(' / ') : null
}

/** 管理地址统一显示为"已配置"/"未配置" */
function manageUrlStatus(url?: string | null): string {
  return url ? '已配置' : '未配置'
}

/**
 * 宿主机名称 hover 预览行（最多 6 行）：
 * 只展示物理机自身信息，不塞 VM 列表。
 * 1. 厂商/型号  2. 系统/用途  3. 内网IP  4. CPU/内存  5. 磁盘  6. 管理地址
 */
export function buildHostPreviewRows(
  host: ServerListItem,
  _children: ServerListItem[] = [],
): ServerPreviewRow[] {
  return [
    { label: '厂商/型号', value: joinParts(host.manufacturer, host.model) },
    { label: '系统/用途', value: joinParts(host.os, host.purpose) },
    { label: '内网IP', value: host.internalIp },
    { label: 'CPU/内存', value: joinParts(host.cpuModel, host.cpuCores, host.memorySize) },
    { label: '磁盘', value: joinParts(host.systemDiskSize, host.dataDiskSize) },
    { label: '管理地址', value: manageUrlStatus(host.manageUrl) },
  ]
}

/**
 * VM 摘要区 hover 预览行（VM 列表，最多 8 行）：
 * 1. 虚拟机数量/运行/停用  2-7. 最多 6 台 VM（名称 · IP · 用途 · 状态）  8. 其余 N 台
 */
export function buildVmListPreviewRows(
  children: ServerListItem[],
): ServerPreviewRow[] {
  if (children.length === 0) {
    return [{ label: '虚拟机', value: '无' }]
  }

  const running = children.filter(v => v.status === '正常').length
  const stopped = children.length - running
  const summary = `共 ${children.length} 台 · 运行 ${running}` + (stopped > 0 ? ` · 停用 ${stopped}` : '')

  const rows: ServerPreviewRow[] = [
    { label: '虚拟机', value: summary },
  ]

  const MAX_PREVIEW = 6
  const previewVms = children.slice(0, MAX_PREVIEW)
  for (const vm of previewVms) {
    rows.push({
      label: vm.name,
      value: [vm.internalIp, vm.purpose].filter(Boolean).join(' · ') || '—',
      tone: vm.status === '正常' ? 'success' : vm.status === '报废' ? 'danger' : 'info',
    })
  }

  const restCount = children.length - MAX_PREVIEW
  if (restCount > 0) {
    rows.push({ label: '其余', value: `${restCount} 台，打开详情查看` })
  }

  return rows
}

/**
 * 虚拟机名称 hover 预览行（最多 7 行）：
 * 1. 宿主机  2. 系统/用途  3. 内网IP  4. 分配CPU/内存/磁盘
 * 5. 状态  6. 宿主管理入口（显示"已配置"/"未配置"）
 */
export function buildVmPreviewRows(
  vm: ServerListItem,
  _host: ServerListItem | null = null,
): ServerPreviewRow[] {
  const rows: ServerPreviewRow[] = [
    { label: '宿主机', value: vm.hostServerName },
    { label: '系统/用途', value: joinParts(vm.os, vm.purpose) },
    { label: '内网IP', value: vm.internalIp },
    {
      label: '分配资源',
      value: joinParts(
        vm.cpuCoresAllocated != null ? `${vm.cpuCoresAllocated}核` : null,
        vm.memoryAllocatedGB != null ? `${vm.memoryAllocatedGB}GB` : null,
        vm.diskAllocatedGB != null ? `${vm.diskAllocatedGB}GB` : null,
      ),
    },
    {
      label: '状态',
      value: vm.status,
      tone: vm.status === '正常' ? 'success' : vm.status === '报废' ? 'danger' : 'info',
    },
    { label: '宿主管理入口', value: manageUrlStatus(vm.hostManageUrl) },
  ]

  return rows
}
