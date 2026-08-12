/**
 * 导出当前页 CSV（UTF-8 BOM，兼容中文 Excel）。
 *
 * v0.2 规范：
 * - 按钮文案必须为"导出当前页 CSV"
 * - 仅导出当前页可见的非敏感白名单列
 * - 不新增导出 API，不做 Excel/XLSX
 * - 不假装导出了全部筛选结果
 */

export interface CsvColumn<T> {
  prop: keyof T & string
  label: string
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

  // UTF-8 BOM，确保中文 Excel 打开正常
  const BOM = '\uFEFF'

  // CSV 转义：包含逗号、引号、换行的字段需用双引号包裹，内部双引号转义为两个双引号
  function escapeCell(value: unknown): string {
    const str = value != null ? String(value) : ''
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const header = columns.map(c => escapeCell(c.label)).join(',')
  const rows = data.map(row =>
    columns.map(c => escapeCell(row[c.prop])).join(','),
  )
  const csv = BOM + [header, ...rows].join('\r\n')

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
