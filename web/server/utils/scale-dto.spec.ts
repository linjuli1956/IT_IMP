/**
 * 电子称 DTO 校验 单元测试
 * 覆盖：唯一字段 trim→NULL、数值非负、日期真实、interface/status 枚举。
 */
import { describe, it, expect } from 'vitest'
import { validateScaleFields, mapScaleApiError } from './scale-dto'

describe('validateScaleFields', () => {
  it('合法字段通过（含 trim 与空串转 NULL）', () => {
    const r = validateScaleFields({
      storeId: 1, assetNo: ' SC-001 ', brand: ' 寺冈 ', serialNo: ' ',
      capacityKg: 30, precisionG: 1, lastCalibrationDate: '2026-01-10',
      nextCalibrationDate: '2026-04-10', status: '正常',
    })
    expect(r.errors).toEqual([])
    expect(r.data.assetNo).toBe('SC-001')
    expect(r.data.brand).toBe('寺冈')
    expect(r.data.serialNo).toBeNull()
  })

  it('数值字段：空串→null、0 合法、负数报错', () => {
    expect(validateScaleFields({ capacityKg: '' }).data.capacityKg).toBeNull()
    expect(validateScaleFields({ precisionG: 0 }).data.precisionG).toBe(0)
    expect(validateScaleFields({ capacityKg: -1 }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ calibrationCycleDays: 1.5 }).errors.length).toBeGreaterThan(0)
  })

  it('校准日期：假日期报错，空串→null', () => {
    expect(validateScaleFields({ nextCalibrationDate: '2026-02-31' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ lastCalibrationDate: '' }).data.lastCalibrationDate).toBeNull()
  })

  it('interface/status 枚举', () => {
    expect(validateScaleFields({ interface: '蓝牙' }).errors).toEqual([])
    expect(validateScaleFields({ interface: 'NFC' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ status: '启用' }).errors.length).toBeGreaterThan(0)
  })
})

describe('mapScaleApiError', () => {
  it('P2002 → 409；P2025 → 404；未知 → null', () => {
    expect(mapScaleApiError({ code: 'P2002' })?.statusCode).toBe(409)
    expect(mapScaleApiError({ code: 'P2025' })?.statusCode).toBe(404)
    expect(mapScaleApiError({ code: 'P1001' })).toBeNull()
  })
})

describe('Decimal 精度校验', () => {
  it('precisionG 超 DECIMAL(8,2) 范围（>999999.99）→ 400', () => {
    expect(validateScaleFields({ precisionG: 1000000 }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ precisionG: 999999.99 }).errors.length).toBe(0)
  })
  it('capacityKg 超 DECIMAL(10,2) 范围 → 400', () => {
    expect(validateScaleFields({ capacityKg: 100000000 }).errors.length).toBeGreaterThan(0)
  })
  it('超过 2 位小数 → 400（不隐式截断/四舍五入）', () => {
    expect(validateScaleFields({ capacityKg: 30.001 }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ precisionG: 1.999 }).errors.length).toBeGreaterThan(0)
  })
})
