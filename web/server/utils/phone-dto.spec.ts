/**
 * 固话 DTO 校验 单元测试
 * 覆盖：phoneNumber 必填+trim、carrier/status 枚举、monthlyFee 非负、可空文本 trim→NULL。
 */
import { describe, it, expect } from 'vitest'
import { validatePhoneFields, mapPhoneApiError } from './phone-dto'

describe('validatePhoneFields', () => {
  it('合法字段通过（含 trim 与空串转 NULL）', () => {
    const r = validatePhoneFields({
      storeId: 1, phoneNumber: ' 0555-1234567 ', department: ' 信息部 ',
      carrier: '电信', monthlyFee: 20.5, extension: '', user: '张三',
    })
    expect(r.errors).toEqual([])
    expect(r.data.phoneNumber).toBe('0555-1234567')
    expect(r.data.department).toBe('信息部')
    expect(r.data.extension).toBeNull()
  })

  it('phoneNumber 必填且不能为空串', () => {
    expect(validatePhoneFields({ phoneNumber: '' }).errors.some(e => e.includes('phoneNumber'))).toBe(true)
    expect(validatePhoneFields({ phoneNumber: '   ' }).errors.length).toBeGreaterThan(0)
  })

  it('carrier 只允许 电信/移动/联通/其他', () => {
    expect(validatePhoneFields({ carrier: '铁通' }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ carrier: '移动' }).errors).toEqual([])
  })

  it('monthlyFee 非负数字，空串→null', () => {
    expect(validatePhoneFields({ monthlyFee: -1 }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ monthlyFee: 'abc' }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ monthlyFee: '' }).data.monthlyFee).toBeNull()
    expect(validatePhoneFields({ monthlyFee: 0 }).data.monthlyFee).toBe(0)
  })

  it('status 只允许 正常/停用/报废', () => {
    expect(validatePhoneFields({ status: '启用' }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ status: '报废' }).errors).toEqual([])
  })

  it('storeId 非正整数报错', () => {
    expect(validatePhoneFields({ storeId: 0 }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ storeId: 1.5 }).errors.length).toBeGreaterThan(0)
  })
})

describe('mapPhoneApiError', () => {
  it('P2002 号码重复 → 409；P2025 → 404；未知 → null', () => {
    expect(mapPhoneApiError({ code: 'P2002' })?.statusCode).toBe(409)
    expect(mapPhoneApiError({ code: 'P2025' })?.statusCode).toBe(404)
    expect(mapPhoneApiError({ code: 'P1001' })).toBeNull()
  })
})

describe('NULL 与非法类型清洗', () => {
  it('显式 null 不转字符串"null"', () => {
    const r = validatePhoneFields({ department: null, extension: null, user: null })
    expect(r.data.department).toBeNull()
    expect(r.data.extension).toBeNull()
    expect(r.data.user).toBeNull()
  })
  it('对象/数组/布尔/数字 → 400（不 String() 静默转换）', () => {
    for (const bad of [{}, [], true, 42]) {
      expect(validatePhoneFields({ department: bad }).errors.length).toBeGreaterThan(0)
    }
  })
  it('phoneNumber 为 null/对象/数组/空串 → 400', () => {
    for (const bad of [null, {}, [], '', '  ']) {
      expect(validatePhoneFields({ phoneNumber: bad }).errors.length).toBeGreaterThan(0)
    }
  })
  it('monthlyFee Infinity → 400（Number.isFinite）', () => {
    expect(validatePhoneFields({ monthlyFee: Infinity }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ monthlyFee: 999999999 }).errors.length).toBeGreaterThan(0)
  })
})

describe('Decimal 精度校验', () => {
  it('monthlyFee 超 DECIMAL(10,2) 范围 → 400', () => {
    expect(validatePhoneFields({ monthlyFee: 100000000 }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ monthlyFee: 99999999.99 }).errors.length).toBe(0)
  })
  it('monthlyFee 超过 2 位小数 → 400', () => {
    expect(validatePhoneFields({ monthlyFee: 20.555 }).errors.length).toBeGreaterThan(0)
    expect(validatePhoneFields({ monthlyFee: 20.55 }).errors.length).toBe(0)
  })
})
