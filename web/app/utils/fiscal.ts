/**
 * 预算财年纯函数工具（无 composable / 浏览器依赖，可单元测试）
 * 财年规则：财年从配置的起始月（默认 4）起算，覆盖 12 个月，如起始月 4 → 4月~次年3月。
 */

/** 生成指定财年的12个月份数组（财年=起始月~次年(起始月-1)月，默认 4 月~次年3月） */
export function getFiscalYearMonths(year: number, startMonth = 4): string[] {
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const month = ((startMonth - 1 + i) % 12) + 1
    const y = startMonth + i > 12 ? year + 1 : year
    months.push(`${y}-${String(month).padStart(2, '0')}`)
  }
  return months
}

/** 月份显示标签：从 "2026-04" 提取 "4月" */
export function getMonthLabel(month: string): string {
  const parts = month.split('-')
  return `${parseInt(parts[1] ?? '1')}月`
}

// 26财年月份（保留作为默认引用）
export const fiscalYearMonths = getFiscalYearMonths(2026)

// 月份显示标签（保留作为默认引用）
export const monthLabels: Record<string, string> = Object.fromEntries(
  fiscalYearMonths.map(m => [m, getMonthLabel(m)])
)

/** 判断费用项在某月是否生效（feeRange格式为 "YYYY-MM~YYYY-MM"） */
export function isFeeActiveInMonth(feeRange: string, month: string): boolean {
  if (!feeRange) return true // 空范围 = 全年有效
  const parts = feeRange.split('~')
  if (parts.length !== 2) return true
  const start = parts[0]?.trim() ?? ''
  const end = parts[1]?.trim() ?? ''
  // YYYY-MM 格式可直接按字符串比较
  return month >= start && month <= end
}

/** 格式化费用范围用于表格显示："2026-01~2026-12" → "2026年1月~12月" */
export function formatFeeRange(range: string): string {
  if (!range) return ''
  const parts = range.split('~')
  if (parts.length !== 2) return range
  const start = parts[0]?.trim() ?? ''
  const end = parts[1]?.trim() ?? ''
  const y1 = start.split('-')[0]
  const m1 = start.split('-')[1]
  const y2 = end.split('-')[0]
  const m2 = end.split('-')[1]
  if (!y1 || !m1 || !y2 || !m2) return range
  if (y1 === y2) {
    return `${y1}年${parseInt(m1)}月~${parseInt(m2)}月`
  }
  return `${y1}年${parseInt(m1)}月~${y2}年${parseInt(m2)}月`
}

/** 将费用范围整体平移 N 年："2026-04~2027-03" +1 → "2027-04~2028-03"；仅对 YYYY-MM~YYYY-MM 格式平移，其余保持原样 */
export function shiftFeeRangeByYear(feeRange: string, offset = 1): string {
  if (!feeRange) return feeRange
  const parts = feeRange.split('~')
  if (parts.length !== 2) return feeRange
  const [start, end] = parts.map(p => p.trim())
  // 非 YYYY-MM~YYYY-MM 格式不平移（防御：避免把不完整日期误平移）
  if (!start || !end || !/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end)) return feeRange
  const shiftYear = (p: string) => p.replace(/^(\d{4})/, (_, y: string) => String(Number(y) + offset))
  return `${shiftYear(start)}~${shiftYear(end)}`
}
