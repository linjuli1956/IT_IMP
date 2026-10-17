/**
 * 月份工具单元测试（计提月份）
 * 真实断言：合法/非法格式、次月计算、跨年进位、计提月份解析优先级。
 */
import { describe, it, expect } from 'vitest'
import { isValidMonth, getNextMonth, resolveAccrualMonth } from './month'

describe('isValidMonth', () => {
  it('合法月份返回 true', () => {
    expect(isValidMonth('2026-01')).toBe(true)
    expect(isValidMonth('2026-09')).toBe(true)
    expect(isValidMonth('2026-12')).toBe(true)
    expect(isValidMonth('2027-06')).toBe(true)
  })

  it('非法格式返回 false', () => {
    expect(isValidMonth('')).toBe(false)
    expect(isValidMonth('2026-13')).toBe(false)
    expect(isValidMonth('2026-0')).toBe(false)
    expect(isValidMonth('2026-00')).toBe(false)
    expect(isValidMonth('2026/09')).toBe(false)
    expect(isValidMonth('2026-9')).toBe(false)
    expect(isValidMonth('202609')).toBe(false)
    expect(isValidMonth('abc')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
    expect(isValidMonth(undefined)).toBe(false)
    expect(isValidMonth(202609)).toBe(false)
  })
})

describe('getNextMonth', () => {
  it('普通月份返回次月', () => {
    expect(getNextMonth('2026-01')).toBe('2026-02')
    expect(getNextMonth('2026-09')).toBe('2026-10')
    expect(getNextMonth('2026-11')).toBe('2026-12')
  })

  it('12 月跨年进位到次年 1 月', () => {
    expect(getNextMonth('2026-12')).toBe('2027-01')
    expect(getNextMonth('2099-12')).toBe('2100-01')
  })

  it('非法输入返回空字符串', () => {
    expect(getNextMonth('')).toBe('')
    expect(getNextMonth('2026-13')).toBe('')
    expect(getNextMonth('2026-9')).toBe('')
    expect(getNextMonth('abc')).toBe('')
  })
})

describe('resolveAccrualMonth', () => {
  it('未传计提月份时默认取费用月的下个月', () => {
    expect(resolveAccrualMonth('2026-09')).toBe('2026-10')
    expect(resolveAccrualMonth('2026-09', undefined)).toBe('2026-10')
    expect(resolveAccrualMonth('2026-09', null)).toBe('2026-10')
    expect(resolveAccrualMonth('2026-09', '')).toBe('2026-10')
    expect(resolveAccrualMonth('2026-12')).toBe('2027-01')
  })

  it('显式选择的合法计提月份优先', () => {
    expect(resolveAccrualMonth('2026-09', '2026-11')).toBe('2026-11')
    expect(resolveAccrualMonth('2026-09', '2027-01')).toBe('2027-01')
  })

  it('非法计提月份返回 null（调用方据此报错，不写库）', () => {
    expect(resolveAccrualMonth('2026-09', '2026-13')).toBeNull()
    expect(resolveAccrualMonth('2026-09', '2026-9')).toBeNull()
    expect(resolveAccrualMonth('2026-09', 'abc')).toBeNull()
    expect(resolveAccrualMonth('2026-09', '202609')).toBeNull()
  })

  it('费用月非法且未传计提月份时返回 null', () => {
    expect(resolveAccrualMonth('')).toBeNull()
    expect(resolveAccrualMonth('2026-13')).toBeNull()
    expect(resolveAccrualMonth('abc')).toBeNull()
  })
})
