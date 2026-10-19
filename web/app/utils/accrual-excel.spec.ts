/**
 * 计提表 Excel 数据构建单元测试
 * 真实断言：标题、表头（含/不含费用类型）、数据行、小计/合计、制表人。
 */
import { describe, it, expect } from 'vitest'
import {
  getAccrualExcelTitle,
  getAccrualExcelHeaders,
  buildAccrualExcelRows,
  hasAccrualFeeType,
} from './accrual-excel'
import type { Accrual, AccrualGroup, AccrualRow } from '~/types/accrual'

function row(seq: number, overrides: Partial<AccrualRow> = {}): AccrualRow {
  return {
    seq,
    dept: ['网络部'],
    name: `号码${seq}`,
    amount: 100 + seq,
    remark: '',
    source: 'invoice',
    feeType: '',
    ...overrides,
  }
}

function group(store: string, rows: AccrualRow[]): AccrualGroup {
  return {
    store,
    templateId: 1,
    schemeId: 0,
    carrier: '中国移动',
    rows,
    subtotal: rows.reduce((sum, r) => sum + r.amount, 0),
    invoiceAmount: rows.reduce((sum, r) => sum + r.amount, 0),
    reimbursementFormat: '',
    reimbursementCustom: '',
    reimbursementText: '',
  }
}

function accrual(overrides: Partial<Accrual> = {}): Accrual {
  const groups = overrides.groups ?? [group('钟山宝龙店', [row(1), row(2)])]
  return {
    id: 1,
    batchId: 1,
    batchNo: '202609YD01',
    carrier: '中国移动',
    feeMonth: '2026-09',
    method: 'invoice',
    groups,
    totalAmount: groups.reduce((sum, g) => sum + g.subtotal, 0),
    status: 'generated',
    createTime: '2026-09-15 10:00',
    creator: '张三',
    ...overrides,
  }
}

describe('getAccrualExcelTitle', () => {
  it('费用月转中文年月 + 运营商 + 计提表', () => {
    expect(getAccrualExcelTitle(accrual())).toBe('2026年09月中国移动计提表')
    expect(getAccrualExcelTitle(accrual({ feeMonth: '2026-10', carrier: '中国电信' })))
      .toBe('2026年10月中国电信计提表')
  })
})

describe('getAccrualExcelHeaders / hasAccrualFeeType', () => {
  it('无费用类型时 5 列', () => {
    const a = accrual()
    expect(hasAccrualFeeType(a)).toBe(false)
    expect(getAccrualExcelHeaders(a)).toEqual(['序号', '承担部门', '名称/号码', '费用(元)', '备注'])
  })

  it('有费用类型时 6 列', () => {
    const a = accrual({
      groups: [group('门店A', [row(1, { feeType: '宽带费' })])],
    })
    expect(hasAccrualFeeType(a)).toBe(true)
    expect(getAccrualExcelHeaders(a)).toEqual(['序号', '承担部门', '名称/号码', '费用类型', '费用(元)', '备注'])
  })
})

describe('buildAccrualExcelRows', () => {
  it('单门店：表头 + 数据行 + 合计 + 制表人（无小计）', () => {
    const rows = buildAccrualExcelRows(accrual())
    expect(rows.map(r => r.kind)).toEqual(['header', 'data', 'data', 'total', 'footer'])
    expect(rows[1]!.cells).toEqual([1, '网络部', '号码1', 101, ''])
    expect(rows[2]!.cells).toEqual([2, '网络部', '号码2', 102, ''])
    expect(rows[3]!.cells).toEqual(['', '', '合计', 203, ''])
    expect(rows[4]!.cells).toEqual(['制表人：张三'])
  })

  it('多门店：每组后有小计，序号连续，末尾合计', () => {
    const a = accrual({
      groups: [
        group('门店A', [row(1), row(2)]),
        group('门店B', [row(3, { amount: 50 })]),
      ],
    })
    const rows = buildAccrualExcelRows(a)
    expect(rows.map(r => r.kind)).toEqual(['header', 'data', 'data', 'subtotal', 'data', 'subtotal', 'total', 'footer'])
    expect(rows[3]!.cells).toEqual(['', '', '小计', a.groups[0]!.subtotal, ''])
    expect(rows[4]!.cells[0]).toBe(3)
    expect(rows[6]!.cells).toEqual(['', '', '合计', a.totalAmount, ''])
  })

  it('带费用类型时数据行含费用类型列', () => {
    const a = accrual({
      groups: [group('门店A', [row(1, { feeType: '专线费' })])],
    })
    const rows = buildAccrualExcelRows(a)
    expect(rows[1]!.cells).toEqual([1, '网络部', '号码1', '专线费', 101, ''])
  })

  it('部门多值用顿号连接，备注保留', () => {
    const a = accrual({
      groups: [group('门店A', [row(1, { dept: ['网络部', '财务部'], remark: '季度费用' })])],
    })
    const rows = buildAccrualExcelRows(a)
    expect(rows[1]!.cells[1]).toBe('网络部、财务部')
    expect(rows[1]!.cells[4]).toBe('季度费用')
  })
})
