/**
 * 电子称 DTO 校验 单元测试
 * 覆盖：唯一字段 trim→NULL、数值非负、日期真实、interface/status 枚举、秤号/IPv4 校验。
 */
import { describe, it, expect } from 'vitest'
import { validateScaleFields, mapScaleApiError, serializeScale } from './scale-dto'

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

  it('P2002 target 含 scaleNo → 409「该门店已存在相同秤号」', () => {
    const r = mapScaleApiError({ code: 'P2002', meta: { target: ['storeId', 'scaleNo'] } })
    expect(r?.statusCode).toBe(409)
    expect(r?.message).toContain('秤号')
  })

  it('P2002 target 不含 scaleNo → 409「资产编号/序列号」', () => {
    const r = mapScaleApiError({ code: 'P2002', meta: { target: ['assetNo'] } })
    expect(r?.statusCode).toBe(409)
    expect(r?.message).toContain('资产编号')
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

describe('scaleNo 校验', () => {
  it('合法秤号通过（含 trim）', () => {
    const r = validateScaleFields({ scaleNo: ' 生鲜03 ' })
    expect(r.errors).toEqual([])
    expect(r.data.scaleNo).toBe('生鲜03')
  })

  it('空值/空串 → null（不报错）', () => {
    expect(validateScaleFields({ scaleNo: null }).data.scaleNo).toBeNull()
    expect(validateScaleFields({ scaleNo: '' }).data.scaleNo).toBeNull()
    expect(validateScaleFields({ scaleNo: '   ' }).data.scaleNo).toBeNull()
  })

  it('对象/数组/布尔 → 400（不静默 String() 转换）', () => {
    expect(validateScaleFields({ scaleNo: { a: 1 } }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ scaleNo: [1, 2] }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ scaleNo: true }).errors.length).toBeGreaterThan(0)
  })
})

describe('ipAddress 校验', () => {
  it('合法 IPv4 通过', () => {
    expect(validateScaleFields({ ipAddress: '192.168.1.100' }).errors).toEqual([])
    expect(validateScaleFields({ ipAddress: '10.0.0.1' }).errors).toEqual([])
    expect(validateScaleFields({ ipAddress: '0.0.0.0' }).errors).toEqual([])
    expect(validateScaleFields({ ipAddress: '255.255.255.255' }).errors).toEqual([])
  })

  it('空值/空串 → null（不报错，RS232/USB 电子秤可不填）', () => {
    expect(validateScaleFields({ ipAddress: null }).data.ipAddress).toBeNull()
    expect(validateScaleFields({ ipAddress: '' }).data.ipAddress).toBeNull()
    expect(validateScaleFields({ ipAddress: '   ' }).data.ipAddress).toBeNull()
  })

  it('非法 IPv4 → 400', () => {
    expect(validateScaleFields({ ipAddress: '999.1.1.1' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: '192.168.1' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: '192.168.1.1.1' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: 'abc' }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: '192.168.1.abc' }).errors.length).toBeGreaterThan(0)
  })

  it('对象/数组/布尔/数字 → 400（不静默 String() 转换）', () => {
    expect(validateScaleFields({ ipAddress: { ip: '1' } }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: [1, 2] }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: true }).errors.length).toBeGreaterThan(0)
    expect(validateScaleFields({ ipAddress: 12345 }).errors.length).toBeGreaterThan(0)
  })
})

describe('serializeScale 序列化', () => {
  it('包含 scaleNo 和 ipAddress 字段', () => {
    const r = serializeScale({
      id: 1, storeId: 1, scaleNo: '生鲜03', ipAddress: '10.0.0.1',
      store: { name: '泰兴总店' },
      capacityKg: '30.00', precisionG: '1.00',
      lastCalibrationDate: new Date('2026-01-10'),
      nextCalibrationDate: new Date('2026-04-10'),
    })
    expect(r.scaleNo).toBe('生鲜03')
    expect(r.ipAddress).toBe('10.0.0.1')
    expect(r.storeName).toBe('泰兴总店')
    expect(r.capacityKg).toBe(30)
    expect(r.precisionG).toBe(1)
    expect(r.lastCalibrationDate).toBe('2026-01-10')
    expect(r.nextCalibrationDate).toBe('2026-04-10')
  })

  it('scaleNo/ipAddress 为 null 时序列化为 null', () => {
    const r = serializeScale({
      id: 2, storeId: 1, scaleNo: null, ipAddress: null,
      store: { name: '泰兴总店' },
      capacityKg: null, precisionG: null,
      lastCalibrationDate: null, nextCalibrationDate: null,
    })
    expect(r.scaleNo).toBeNull()
    expect(r.ipAddress).toBeNull()
  })
})
