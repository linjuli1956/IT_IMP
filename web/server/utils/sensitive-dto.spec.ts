/**
 * 敏感字段脱敏 DTO 单元测试
 * 覆盖：列表/详情/CUD 响应剥离明文 + "是否已配置"标记
 */
import { describe, it, expect } from 'vitest'
import {
  toDomainDto,
  toMiniappDto,
  toPaymentDto,
} from './sensitive-dto'

describe('toDomainDto', () => {
  it('剥离 mainPassword 明文，附带 mainPasswordSet=true', () => {
    const dto = toDomainDto({
      id: 1, domain: 'example.invalid', mainAccount: 'acc', mainPassword: 'secret-pw',
      certType: 'DV', status: '正常',
    })
    expect(dto).not.toHaveProperty('mainPassword')
    expect(JSON.stringify(dto)).not.toContain('secret-pw')
    expect(dto.mainPasswordSet).toBe(true)
    expect(dto.domain).toBe('example.invalid')
    expect(dto.mainAccount).toBe('acc')
  })

  it('未配置密码时 mainPasswordSet=false', () => {
    const dto = toDomainDto({ id: 2, domain: 'a.invalid', mainAccount: 'acc', mainPassword: '' })
    expect(dto.mainPasswordSet).toBe(false)
  })
})

describe('toMiniappDto', () => {
  it('剥离 emailPassword 明文，附带 emailPasswordSet 标记', () => {
    const dto = toMiniappDto({ id: 1, name: '小程序A', email: 'a@x.com', emailPassword: 'mail-secret' })
    expect(dto).not.toHaveProperty('emailPassword')
    expect(JSON.stringify(dto)).not.toContain('mail-secret')
    expect(dto.emailPasswordSet).toBe(true)
  })

  it('密码为 null 时 emailPasswordSet=false', () => {
    const dto = toMiniappDto({ id: 2, name: 'B', email: '', emailPassword: null })
    expect(dto.emailPasswordSet).toBe(false)
  })
})

describe('toPaymentDto', () => {
  it('isSensitive=true 时剥离 configValue 明文，附带 sensitiveConfigured 标记', () => {
    const dto = toPaymentDto({
      id: 1, storeId: 'S01', storeName: '门店', payMethod: 'wx', payMethodName: '微信',
      provider: '服务商', configName: '密钥', configValue: 'api-key-secret', isSensitive: true,
    })
    expect(dto).not.toHaveProperty('configValue')
    expect(JSON.stringify(dto)).not.toContain('api-key-secret')
    expect(dto.sensitiveConfigured).toBe(true)
    expect(dto.configName).toBe('密钥')
  })

  it('isSensitive=false 时保留 configValue（普通配置不脱敏）', () => {
    const dto = toPaymentDto({
      id: 2, storeId: 'S01', storeName: '门店', payMethod: 'wx', payMethodName: '微信',
      provider: '服务商', configName: '商户号', configValue: 'MCH-001', isSensitive: false,
    })
    expect(dto.configValue).toBe('MCH-001')
    expect(dto).not.toHaveProperty('sensitiveConfigured')
  })
})
