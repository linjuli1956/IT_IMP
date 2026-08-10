/**
 * 网络拓扑视觉工具：集中管理设备类型色、状态边框色、透明度。
 * 颜色值从 tokens.css 的 CSS 变量运行时解析（SSR 用 fallback）。
 * 禁止在页面/组件中硬编码 # 色值，统一引用此工具。
 */

/** 设备类型列表（与设计文档一致） */
export const DEVICE_TYPES = ['交换机', '路由器', '防火墙', 'AP', '其他'] as const

/** 设备类型 → CSS 变量名 + fallback 色值 */
const TYPE_COLOR_MAP: Record<string, { var: string; fallback: string }> = {
  '交换机': { var: '--topo-type-switch', fallback: '#409EFF' },
  '路由器': { var: '--topo-type-router', fallback: '#E6A23C' },
  '防火墙': { var: '--topo-type-firewall', fallback: '#F56C6C' },
  'AP': { var: '--topo-type-ap', fallback: '#67C23A' },
  '其他': { var: '--topo-type-other', fallback: '#909399' },
}
const DEFAULT_TYPE_ENTRY = { var: '--topo-type-other', fallback: '#909399' }

/** 状态 → CSS 变量名 + fallback 色值 */
const STATUS_BORDER_MAP: Record<string, { var: string; fallback: string }> = {
  '正常': { var: '--topo-status-normal', fallback: '#67C23A' },
  '停用': { var: '--topo-status-stopped', fallback: '#909399' },
  '报废': { var: '--topo-status-scrapped', fallback: '#F56C6C' },
}
const DEFAULT_STATUS_ENTRY = { var: '--topo-status-stopped', fallback: '#909399' }

/** 运行时读取 CSS 变量，SSR 或不可用时返回 fallback */
function readCssVar(varName: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    return v || fallback
  } catch {
    return fallback
  }
}

/** 获取设备类型色 */
export function getDeviceTypeColor(type: string): string {
  const entry = TYPE_COLOR_MAP[type] || DEFAULT_TYPE_ENTRY
  return readCssVar(entry.var, entry.fallback)
}

/** 获取状态边框色 */
export function getStatusBorderColor(status: string): string {
  const entry = STATUS_BORDER_MAP[status] || DEFAULT_STATUS_ENTRY
  return readCssVar(entry.var, entry.fallback)
}

/** 获取状态透明度 */
export function getStatusOpacity(status: string): number {
  if (status === '正常') return 1
  if (status === '停用') return 0.5
  if (status === '报废') return 0.3
  return 1
}

/** 获取连线色 */
export function getEdgeColor(): string {
  return readCssVar('--topo-edge-color', '#C0C4CC')
}

/** 获取节点标签色 */
export function getLabelColor(): string {
  return readCssVar('--topo-label-color', '#303133')
}

/** 获取边标签色 */
export function getEdgeLabelColor(): string {
  return readCssVar('--topo-edge-label-color', '#909399')
}

/** 获取设备类型色图例（供图例渲染） */
export function getTypeColorEntries(): { type: string; color: string }[] {
  return DEVICE_TYPES.map((type) => ({ type, color: getDeviceTypeColor(type) }))
}

/** 获取状态边框色图例（供图例渲染） */
export function getStatusBorderEntries(): { status: string; color: string; opacity: number }[] {
  return [
    { status: '正常', color: getStatusBorderColor('正常'), opacity: 1 },
    { status: '停用', color: getStatusBorderColor('停用'), opacity: 0.5 },
    { status: '报废', color: getStatusBorderColor('报废'), opacity: 0.3 },
  ]
}

/**
 * HTML 转义：防止设备备注、型号等动态内容在 ECharts tooltip 中注入 DOM。
 * ECharts tooltip formatter 返回 HTML 字符串，未转义的用户输入可能导致 XSS。
 */
export function escapeHtml(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
