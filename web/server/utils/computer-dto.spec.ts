/**
 * 电脑 DTO 校验 单元测试
 * 覆盖：唯一字段 trim→NULL、整数非负、日期真实、diskType/status 枚举。
 */
import { describe, it, expect } from 'vitest'
import { validateComputerFields, mapComputerApiError } from './computer-dto'

describe('validateComputerFields', () => {
  it('合法字段通过（含 trim 与空串转 NULL）', () => {
    const r = validateComputerFields({
      storeId: 1, assetNo: ' PC-001 ', brand: ' 联想 ', serialNo: ' ',
      cpuCores: 8, memoryGB: 16, diskSizeGB: 512, purchaseDate: '2026-01-15',
      status: '正常',
    })
    expect(r.errors).toEqual([])
    expect(r.data.assetNo).toBe('PC-001')
    expect(r.data.brand).toBe('联想')
    expect(r.data.serialNo).toBeNull()
    expect(r.data.cpuCores).toBe(8)
  })

  it('整数字段：空串→null、0 合法、负数/小数报错', () => {
    expect(validateComputerFields({ cpuCores: '' }).data.cpuCores).toBeNull()
    expect(validateComputerFields({ memoryGB: 0 }).data.memoryGB).toBe(0)
    expect(validateComputerFields({ diskSizeGB: -1 }).errors.length).toBeGreaterThan(0)
    expect(validateComputerFields({ cpuCores: 1.5 }).errors.length).toBeGreaterThan(0)
  })

  it('日期字段：假日期/格式错报错，空串→null', () => {
    expect(validateComputerFields({ purchaseDate: '2026-02-31' }).errors.length).toBeGreaterThan(0)
    expect(validateComputerFields({ warrantyEndDate: '2026/01/01' }).errors.length).toBeGreaterThan(0)
    expect(validateComputerFields({ purchaseDate: '' }).data.purchaseDate).toBeNull()
    expect(validateComputerFields({ purchaseDate: '2026-02-28' }).errors).toEqual([])
  })

  it('diskType/status 枚举', () => {
    expect(validateComputerFields({ diskType: 'NVMe' }).errors.length).toBeGreaterThan(0)
    expect(validateComputerFields({ diskType: 'SSD' }).errors).toEqual([])
    expect(validateComputerFields({ status: '启用' }).errors.length).toBeGreaterThan(0)
  })

  it('storeId 非正整数报错', () => {
    expect(validateComputerFields({ storeId: 0 }).errors.length).toBeGreaterThan(0)
  })
})

describe('mapComputerApiError', () => {
  it('P2002 → 409；P2025 → 404；未知 → null', () => {
    expect(mapComputerApiError({ code: 'P2002' })?.statusCode).toBe(409)
    expect(mapComputerApiError({ code: 'P2025' })?.statusCode).toBe(404)
    expect(mapComputerApiError({ code: 'P1001' })).toBeNull()
  })
})
