/**
 * 预算财年纯函数 单元测试
 * 覆盖：自定义起始月的财年月份生成、费用范围按年平移（生成下个财年核心逻辑）。
 */
import { describe, it, expect } from 'vitest'
import { getFiscalYearMonths, shiftFeeRangeByYear } from './fiscal'

describe('getFiscalYearMonths', () => {
  it('默认起始月 4：4月~次年3月', () => {
    expect(getFiscalYearMonths(2026)).toEqual([
      '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09',
      '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    ])
  })

  it('自定义起始月 1：1月~12月（同一年）', () => {
    const months = getFiscalYearMonths(2026, 1)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-01')
    expect(months[11]).toBe('2026-12')
  })

  it('自定义起始月 7：7月~次年6月（跨年）', () => {
    const months = getFiscalYearMonths(2026, 7)
    expect(months).toHaveLength(12)
    expect(months[0]).toBe('2026-07')
    expect(months[5]).toBe('2026-12')
    expect(months[6]).toBe('2027-01')
    expect(months[11]).toBe('2027-06')
  })
})

describe('shiftFeeRangeByYear', () => {
  it('跨年范围平移一年', () => {
    expect(shiftFeeRangeByYear('2026-04~2027-03')).toBe('2027-04~2028-03')
  })

  it('同年范围平移一年', () => {
    expect(shiftFeeRangeByYear('2026-01~2026-12')).toBe('2027-01~2027-12')
  })

  it('空范围保持为空（全年有效）', () => {
    expect(shiftFeeRangeByYear('')).toBe('')
  })

  it('格式不符保持原样', () => {
    expect(shiftFeeRangeByYear('2026-04~2027')).toBe('2026-04~2027')
  })
})
