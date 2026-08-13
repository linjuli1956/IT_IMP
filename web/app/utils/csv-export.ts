/**
 * 导出当前页 CSV（UTF-8 BOM，兼容中文 Excel）。
 *
 * v0.2 规范：
 * - 按钮文案必须为"导出当前页 CSV"
 * - 仅导出当前页可见的非敏感白名单列
 * - 不新增导出 API，不做 Excel/XLSX
 * - 不假装导出了全部筛选结果
 * - 防止 Excel 公式注入（= + - @ 开头的单元格前置单引号）
 */

export interface CsvColumn<T> {
  prop: keyof T & string
  label: string
}

/** UTF-8 BOM，确保中文 Excel 打开正常 */
const CSV_BOM = '\uFEFF'

/** 公式注入风险字符：以这些字符开头的单元格会被 Excel 当作公式 */
const FORMULA_INJECTION_CHARS = new Set(['=', '+', '-', '@'])

/**
 * 单个单元格转义（纯函数，可单元测试）。
 *
 * 1. null/undefined → 空字符串
 * 2. 公式注入防护：首字符为 = + - @ 时前置英文单引号
 * 3. CSV 转义：包含逗号、引号、换行时用双引号包裹，内部双引号转义为两个双引号
 */
export function escapeCsvCell(value: unknown): string {
  const str = value != null ? String(value) : ''
  if (str === '') return ''

  // 公式注入防护
  let safe = str
  const firstChar = str[0]
  if (firstChar && FORMULA_INJECTION_CHARS.has(firstChar)) {
    safe = `'${str}`
  }

  // CSV 转义
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`
  }
  return safe
}

/**
 * 将列定义和数据序列化为完整 CSV 字符串（含 BOM）（纯函数，可单元测试）。
 */
export function serializeCsv<T extends Record<string, any>>(
  columns: CsvColumn<T>[],
  data: T[],
): string {
  const header = columns.map(c => escapeCsvCell(c.label)).join(',')
  const rows = data.map(row =>
    columns.map(c => escapeCsvCell(row[c.prop])).join(','),
  )
  return CSV_BOM + [header, ...rows].join('\r\n')
}

/**
 * 将当前页数据导出为 CSV 文件（UTF-8 BOM）。
 *
 * @param filename 文件名（不含扩展名，自动追加 .csv）
 * @param columns  导出列配置（仅白名单列）
 * @param data     当前页数据
 */
export function exportCurrentPageCsv<T extends Record<string, any>>(
  filename: string,
  columns: CsvColumn<T>[],
  data: T[],
): void {
  if (data.length === 0) return

  const csv = serializeCsv(columns, data)

  // 创建下载链接
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
