/**
 * 计提表 Excel 导出的纯数据构建（与打印版式一致）
 *
 * 版式：标题 → 表头 → 各门店数据行（多门店时每组后小计）→ 合计 → 制表人。
 * 本文件只负责「行列数据」，不加任何样式；样式与文件生成在详情页用 ExcelJS 完成。
 */

import type { Accrual, AccrualRow } from '~/types/accrual'

export type AccrualExcelRowKind = 'header' | 'data' | 'subtotal' | 'total' | 'footer'

export interface AccrualExcelRow {
  kind: AccrualExcelRowKind
  cells: (string | number)[]
}

/** 计提表标题：2026-09 + 中国移动 → 2026年09月中国移动计提表 */
export function getAccrualExcelTitle(accrual: Accrual): string {
  const monthStr = accrual.feeMonth.replace(/-(\d{2})$/, '年$1月')
  return `${monthStr}${accrual.carrier}计提表`
}

/** 表头（与打印一致：有费用类型时多一列） */
export function getAccrualExcelHeaders(accrual: Accrual): string[] {
  const hasFeeType = accrual.groups.some(group => group.rows.some(row => row.feeType))
  return hasFeeType
    ? ['序号', '承担部门', '名称/号码', '费用类型', '费用(元)', '备注']
    : ['序号', '承担部门', '名称/号码', '费用(元)', '备注']
}

/** 费用类型列是否存在 */
export function hasAccrualFeeType(accrual: Accrual): boolean {
  return accrual.groups.some(group => group.rows.some(row => row.feeType))
}

/**
 * 构建整张表的数据行（表头 + 数据 + 小计 + 合计 + 制表人）。
 * 金额使用 number 输出，便于 Excel 数值格式化。
 */
export function buildAccrualExcelRows(accrual: Accrual): AccrualExcelRow[] {
  const hasFeeType = hasAccrualFeeType(accrual)
  const hasMultipleGroups = accrual.groups.length > 1
  const feeTypeCell = (row: AccrualRow): string[] => (hasFeeType ? [row.feeType || ''] : [])

  const rows: AccrualExcelRow[] = [
    { kind: 'header', cells: getAccrualExcelHeaders(accrual) },
  ]

  let seqCounter = 0
  for (const group of accrual.groups) {
    for (const row of group.rows) {
      seqCounter++
      rows.push({
        kind: 'data',
        cells: [
          seqCounter,
          (row.dept || []).join('、'),
          row.name,
          ...feeTypeCell(row),
          Number(row.amount) || 0,
          row.remark || '',
        ],
      })
    }
    if (hasMultipleGroups) {
      rows.push({
        kind: 'subtotal',
        cells: ['', '', '小计', ...(hasFeeType ? [''] : []), Number(group.subtotal) || 0, ''],
      })
    }
  }

  rows.push({
    kind: 'total',
    cells: ['', '', '合计', ...(hasFeeType ? [''] : []), Number(accrual.totalAmount) || 0, ''],
  })
  rows.push({ kind: 'footer', cells: [`制表人：${accrual.creator || ''}`] })

  return rows
}
