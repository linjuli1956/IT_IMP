/**
 * 资产 DTO 序列化 单元测试
 * 覆盖：Decimal→number、DATE→YYYY-MM-DD、store 只留 storeName。
 */
import { describe, it, expect } from 'vitest'
import { serializePhone } from './phone-dto'
import { serializeComputer } from './computer-dto'
import { serializeScale } from './scale-dto'

describe('serializePhone', () => {
  it('monthlyFee Decimal→number，store→storeName', () => {
    const p = serializePhone({ id: 1, monthlyFee: '20.5', store: { name: '总店' } })
    expect(p.monthlyFee).toBe(20.5)
    expect(p.storeName).toBe('总店')
    expect(p.store).toBeUndefined()
  })

  it('null 字段保持 null', () => {
    expect(serializePhone({ monthlyFee: null }).monthlyFee).toBeNull()
  })
})

describe('serializeComputer', () => {
  it('DATE→YYYY-MM-DD（ISO 输入格式化）', () => {
    const c = serializeComputer({
      id: 1, purchaseDate: new Date('2026-01-15T00:00:00.000Z'), warrantyEndDate: null,
      store: { name: '总店' },
    })
    expect(c.purchaseDate).toBe('2026-01-15')
    expect(c.warrantyEndDate).toBeNull()
    expect(c.storeName).toBe('总店')
  })
})

describe('serializeScale', () => {
  it('Decimal→number、DATE→YYYY-MM-DD、storeName', () => {
    const s = serializeScale({
      id: 1, capacityKg: '30.00', precisionG: '1.00',
      lastCalibrationDate: new Date('2026-01-10T00:00:00.000Z'),
      nextCalibrationDate: new Date('2026-04-10T00:00:00.000Z'),
      store: { name: '总店' },
    })
    expect(s.capacityKg).toBe(30)
    expect(s.precisionG).toBe(1)
    expect(s.lastCalibrationDate).toBe('2026-01-10')
    expect(s.nextCalibrationDate).toBe('2026-04-10')
    expect(s.storeName).toBe('总店')
  })
})
