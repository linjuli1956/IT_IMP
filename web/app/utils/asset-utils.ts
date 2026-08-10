/**
 * 资产通用工具（状态/到期/空值清洗）
 * 供 AssetTable / AssetFormDialog 与各资产页面复用；全部使用 Design Token 颜色。
 */

/** 资产状态枚举（全局统一：正常/停用/报废） */
export const ASSET_STATUSES = ['正常', '停用', '报废'] as const

/** 资产状态下拉选项（全局唯一导出源，禁止各模块重复定义） */
export const assetStatusOptions = [
  { value: '正常', label: '正常' },
  { value: '停用', label: '停用' },
  { value: '报废', label: '报废' },
]

/** 资产选项值类型（string/number/boolean，禁止 any 绕过） */
export type AssetOptionValue = string | number | boolean

/** 判断值是否为"空"（空串/null/undefined 视为空；false 与 0 是合法值，不得清空） */
export function isEmptyValue(value: unknown): boolean {
  return value === '' || value === null || value === undefined
}

/** 校准信息（电子称提醒；仅 status=正常 参与，自然日计算，可注入 now 便于测试） */
export interface CalibrationInfo {
  days: number | null        // 距下次校准天数（null=无日期或停用/报废）
  label: string              // 已逾期N天 / 今天应校准 / N天后校准 / —
  tone: 'danger' | 'warning' | 'info' | null
  overdue: boolean
}

export function getCalibrationInfo(
  nextCalibrationDate: string | null | undefined,
  status: string,
  now = new Date(),
): CalibrationInfo {
  // 仅 status=正常 参与提醒；停用/报废不显示预警
  if (status !== '正常' || !nextCalibrationDate) {
    return { days: null, label: '—', tone: null, overdue: false }
  }
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const next = new Date(`${nextCalibrationDate}T00:00:00`)
  if (Number.isNaN(next.getTime())) {
    return { days: null, label: '—', tone: null, overdue: false }
  }
  const days = Math.floor((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { days, label: `已逾期${Math.abs(days)}天`, tone: 'danger', overdue: true }
  if (days === 0) return { days: 0, label: '今天应校准', tone: 'danger', overdue: true }
  if (days <= 30) return { days, label: `${days}天后校准`, tone: 'danger', overdue: false }
  if (days <= 90) return { days, label: `${days}天后校准`, tone: 'warning', overdue: false }
  return { days, label: `${days}天后校准`, tone: 'info', overdue: false }
}

/** 预览值格式化：空值显示 "—"，false/0 正常显示 */
export function formatPreviewValue(value: unknown): string {
  if (isEmptyValue(value)) return '—'
  return String(value)
}

/** 预览行（供 RecordPreviewTooltip） */
export interface PreviewRowLike {
  label: string
  value: unknown
  sensitive?: boolean
}

/** 过滤敏感行：敏感字段永不进入 tooltip DOM（即使 CSS 隐藏也不允许） */
export function filterSensitiveRows<T extends PreviewRowLike>(rows: T[]): T[] {
  return rows.filter(r => !r.sensitive)
}

/** 状态 → el-tag type（全局统一色） */
export function getAssetStatusTagType(status: string): 'success' | 'info' | 'danger' {
  if (status === '正常') return 'success'
  if (status === '报废') return 'danger'
  return 'info'
}

/** 空字符串 → null（可空唯一字段提交用） */
export function normalizeNullable(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

export interface ExpireInfo {
  days: number | null       // 距到期天数（null=无日期）
  tagType: 'info' | 'danger' | 'warning'
  label: string             // 显示文本
}

/** 到期信息：≤30 天红、≤90 天黄、其余 info；无日期返回 null 天数 */
export function getExpireInfo(date: string | null | undefined): ExpireInfo {
  if (!date) return { days: null, tagType: 'info', label: '-' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expire = new Date(`${date}T00:00:00`)
  if (Number.isNaN(expire.getTime())) return { days: null, tagType: 'info', label: '-' }
  const days = Math.floor((expire.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  let tagType: ExpireInfo['tagType'] = 'info'
  if (days <= 30) tagType = 'danger'
  else if (days <= 90) tagType = 'warning'
  let label = `${date} (${days}天)`
  if (days === 0) label = `${date} (今天到期)`
  else if (days < 0) label = `${date} (已过期${Math.abs(days)}天)`
  return { days, tagType, label }
}
