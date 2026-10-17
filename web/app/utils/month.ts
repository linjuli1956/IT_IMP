/**
 * 月份工具 — 计提月份计算（前后端共用）
 *
 * 业务规则：
 * - 计提月份默认 = 费用月的下个月（如费用月 2026-09 → 默认计提月份 2026-10）；
 * - 报销说明与费用月绑定，与计提月份无关（本工具只负责计提月份解析）。
 */

/** 月份格式：YYYY-MM（01-12 月） */
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** 是否为合法的月份字符串（YYYY-MM） */
export function isValidMonth(value: unknown): boolean {
  return typeof value === 'string' && MONTH_PATTERN.test(value)
}

/**
 * 计算下个月（跨年进位：2026-12 → 2027-01）。
 * 非法输入返回空字符串。
 */
export function getNextMonth(month: string): string {
  if (!isValidMonth(month)) return ''
  const [yearStr, monthStr] = month.split('-')
  const year = Number(yearStr)
  const monthIndex = Number(monthStr) // 1-12
  if (monthIndex === 12) {
    return `${year + 1}-01`
  }
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`
}

/**
 * 解析计提月份：
 * - requested 合法 → 使用 requested（用户显式选择）；
 * - requested 未传（null/undefined/空串）→ 费用月的下个月；
 * - 任一分支无法得到合法月份 → null（调用方据此报错，不写库）。
 */
export function resolveAccrualMonth(batchFeeMonth: string, requested?: string | null): string | null {
  if (requested != null && requested !== '') {
    return isValidMonth(requested) ? requested : null
  }
  const next = getNextMonth(batchFeeMonth)
  return next || null
}
