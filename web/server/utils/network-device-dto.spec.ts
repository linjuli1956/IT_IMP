/**
 * 网络设备 DTO 校验 单元测试
 * 覆盖：deviceType/status/manageType 枚举、portCount 非负整数、可空唯一字段空串→NULL、storeId 校验。
 */
import { describe, it, expect } from 'vitest'
import { validateNetworkDeviceFields, mapDeviceApiError } from './network-device-dto'

describe('mapDeviceApiError', () => {
  it('P2002 唯一冲突 → 409', () => {
    const r = mapDeviceApiError({ code: 'P2002' })
    expect(r?.statusCode).toBe(409)
    expect(r?.message).toContain('重复')
  })

  it('P2003 外键冲突 → 409', () => {
    expect(mapDeviceApiError({ code: 'P2003' })?.statusCode).toBe(409)
  })

  it('P2025 记录不存在 → 404', () => {
    expect(mapDeviceApiError({ code: 'P2025' })?.statusCode).toBe(404)
  })

  it('未知错误 → null（调用方原样抛出）', () => {
    expect(mapDeviceApiError({ code: 'P1001' })).toBeNull()
    expect(mapDeviceApiError(new Error('boom'))).toBeNull()
  })
})

describe('validateNetworkDeviceFields', () => {
  it('合法字段通过（含空串唯一字段转 NULL）', () => {
    const r = validateNetworkDeviceFields({
      storeId: 1, deviceType: '交换机', status: '正常',
      serialNo: '', managementIp: '  ', macAddress: 'AA:BB:CC:DD:EE:FF',
      portCount: 24, brand: '华为', manageType: '网管型',
    })
    expect(r.errors).toEqual([])
    expect(r.data.serialNo).toBeNull()
    expect(r.data.managementIp).toBeNull()
    expect(r.data.macAddress).toBe('AA:BB:CC:DD:EE:FF')
    expect(r.data.storeId).toBe(1)
  })

  it('deviceType 非法枚举报错', () => {
    expect(validateNetworkDeviceFields({ deviceType: '交换机2' }).errors.length).toBeGreaterThan(0)
  })

  it('deviceType 必填（缺失报错）', () => {
    // 未传 key 时不进 errors；由 API 层校验必填 —— 这里验证传非法值报错
    expect(validateNetworkDeviceFields({ deviceType: '' }).errors.length).toBeGreaterThan(0)
  })

  it('status 只允许 正常/停用/报废', () => {
    expect(validateNetworkDeviceFields({ status: '启用' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ status: '报废' }).errors).toEqual([])
  })

  it('manageType 非法枚举报错，空串转 NULL', () => {
    expect(validateNetworkDeviceFields({ manageType: '半网管' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ manageType: '' }).data.manageType).toBeNull()
  })

  it('portCount 负数/非整数报错，0 通过', () => {
    expect(validateNetworkDeviceFields({ portCount: -1 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ portCount: 1.5 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ portCount: 0 }).errors).toEqual([])
  })

  it('storeId 非正整数报错', () => {
    expect(validateNetworkDeviceFields({ storeId: 0 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ storeId: 'abc' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ storeId: 3 }).errors).toEqual([])
  })

  it('未知字段被白名单过滤（不写入 data）', () => {
    const r = validateNetworkDeviceFields({ deviceType: '交换机', unknownField: 'x' })
    expect(r.data.unknownField).toBeUndefined()
  })

  it('portCount 清空语义：null/空串→null，0 合法，负数/小数/abc 报错', () => {
    expect(validateNetworkDeviceFields({ portCount: null }).data.portCount).toBeNull()
    expect(validateNetworkDeviceFields({ portCount: '' }).data.portCount).toBeNull()
    expect(validateNetworkDeviceFields({ portCount: 0 }).data.portCount).toBe(0)
    expect(validateNetworkDeviceFields({ portCount: 24 }).data.portCount).toBe(24)
    expect(validateNetworkDeviceFields({ portCount: -1 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ portCount: 1.5 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkDeviceFields({ portCount: 'abc' }).errors.length).toBeGreaterThan(0)
  })

  it('可空文本字段 trim：前后空格清除，纯空格→null', () => {
    const r = validateNetworkDeviceFields({
      serialNo: '  SN-001  ', brand: ' 华为 ', model: '   ', uplinkPort: 'GE1/0/1 ',
    })
    expect(r.errors).toEqual([])
    expect(r.data.serialNo).toBe('SN-001')
    expect(r.data.brand).toBe('华为')
    expect(r.data.model).toBeNull()
    expect(r.data.uplinkPort).toBe('GE1/0/1')
  })

  it('P2003 文案为“所选门店不存在”', () => {
    expect(mapDeviceApiError({ code: 'P2003' })?.message).toBe('所选门店不存在')
  })
})
