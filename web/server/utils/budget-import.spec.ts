/**
 * 预算 Excel 导入解析与校验 单元测试
 * 用 xlsx 在内存构造测试文件，覆盖：正常解析、必填校验、金额/范围格式、表头缺失、空行跳过、列序无关。
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseBudgetRows } from './budget-import'

/** 标准模板表头（与前端下载模板、后端表头别名保持一致） */
const HEADERS = ['财年', '门店', '运营商', '费用类型', '月费(元)', '年费(元)', '费用范围', '宽带类型', '缴费方式', '备注']

/** 构造 xlsx 文件内容（第一行为表头，其后为数据行） */
function buildXlsx(rows: (string | number)[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('parseBudgetRows', () => {
  it('正常解析有效数据行，空金额按 0、空字符串保持空', () => {
    const buffer = buildXlsx([
      HEADERS,
      [2026, '总部信息部', '电信', '宽带', 100, 1200, '2026-04~2027-03', '100M', '月缴费', '测试'],
      [2027, '团购部', '移动', '物联网', 50, '', '', '', '年缴费', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      fiscalYear: 2026,
      storeName: '总部信息部',
      carrier: '电信',
      feeType: '宽带',
      monthlyFee: 100,
      annualFee: 1200,
      feeRange: '2026-04~2027-03',
      broadbandType: '100M',
      paymentMethod: '月缴费',
      remark: '测试',
    })
    expect(rows[1].annualFee).toBe(0)
    expect(rows[1].remark).toBe('')
  })

  it('列顺序变化时仍能按列名正确映射（不依赖列序）', () => {
    const shuffled = ['门店', '运营商', '费用类型', '月费(元)', '财年', '备注', '费用范围', '宽带类型', '年费(元)', '缴费方式']
    const buffer = buildXlsx([
      shuffled,
      ['总部信息部', '电信', '宽带', 100, 2026, '备注A', '2026-04~2027-03', '100M', 1200, '月缴费'],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({ fiscalYear: 2026, storeName: '总部信息部', carrier: '电信', monthlyFee: 100, annualFee: 1200 })
  })

  it('门店为空时报错并携带 Excel 实际行号', () => {
    const buffer = buildXlsx([
      HEADERS,
      [2026, '', '电信', '宽带', 100, 1200, '', '', '', ''],
      [2026, '门店A', '移动', '物联网', 50, 0, '', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(1)
    expect(errors).toEqual([{ row: 2, message: '门店不能为空' }])
  })

  it('月费非数字时报错', () => {
    const buffer = buildXlsx([
      HEADERS,
      [2026, '门店A', '电信', '宽带', 'abc', 0, '', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([{ row: 2, message: '月费需为数字' }])
  })

  it('费用范围格式错误时报错', () => {
    const buffer = buildXlsx([
      HEADERS,
      [2026, '门店A', '电信', '宽带', 100, 0, '2026-04~2027', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([{ row: 2, message: '费用范围格式应为 YYYY-MM~YYYY-MM（如 2026-04~2027-03）' }])
  })

  it('费用范围结束日期早于开始日期时报错', () => {
    const buffer = buildXlsx([
      HEADERS,
      [2026, '门店A', '电信', '宽带', 100, 0, '2027-03~2026-04', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([{ row: 2, message: '费用范围结束日期不能早于开始日期' }])
  })

  it('财年非整数或超出范围时报错', () => {
    const buffer = buildXlsx([
      HEADERS,
      ['明年', '门店A', '电信', '宽带', 100, 0, '', '', '', ''],
      [1999, '门店B', '移动', '物联网', 50, 0, '', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([
      { row: 2, message: '财年需为 2000~2100 的整数（如 2026）' },
      { row: 3, message: '财年需为 2000~2100 的整数（如 2026）' },
    ])
  })

  it('表头缺少必需列时整批拒绝并给出列名', () => {
    const noYearHeaders = HEADERS.filter(h => h !== '财年')
    const buffer = buildXlsx([
      noYearHeaders,
      [2026, '门店A', '电信', '宽带', 100, 0, '', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([{ row: 1, message: '缺少必需列「财年」' }])
  })

  it('全空行被跳过，不产生错误', () => {
    const buffer = buildXlsx([
      HEADERS,
      ['', '', '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', ''],
    ])
    const { rows, errors } = parseBudgetRows(buffer)
    expect(rows).toHaveLength(0)
    expect(errors).toEqual([])
  })
})
