/**
 * 网络设备连接关系 DTO 校验 单元测试
 * 覆盖：body 入口守卫、字段严格类型校验、自连接、反方向重复、同方向重复、错误映射、并发冲突判断。
 */
import { describe, it, expect } from 'vitest'
import {
  validateLinkBody,
  validateNetworkLinkFields,
  checkSelfConnection,
  checkReverseDuplicate,
  checkSameDirectionDuplicate,
  mapLinkApiError,
  isRetryableConcurrencyError,
} from './network-link-dto'

// =====================
// validateLinkBody 入口守卫
// =====================
describe('validateLinkBody', () => {
  it('普通对象通过', () => {
    expect(validateLinkBody({ a: 1 }).ok).toBe(true)
    expect(validateLinkBody({}).ok).toBe(true)
  })

  it('null 拒绝', () => {
    expect(validateLinkBody(null).ok).toBe(false)
  })

  it('数组拒绝', () => {
    expect(validateLinkBody([1, 2]).ok).toBe(false)
    expect(validateLinkBody([]).ok).toBe(false)
  })

  it('字符串拒绝', () => {
    expect(validateLinkBody('hello').ok).toBe(false)
    expect(validateLinkBody('').ok).toBe(false)
  })

  it('数字拒绝', () => {
    expect(validateLinkBody(42).ok).toBe(false)
    expect(validateLinkBody(0).ok).toBe(false)
  })

  it('布尔拒绝', () => {
    expect(validateLinkBody(true).ok).toBe(false)
    expect(validateLinkBody(false).ok).toBe(false)
  })
})

// =====================
// validateNetworkLinkFields 严格类型校验
// =====================
describe('validateNetworkLinkFields', () => {
  it('合法字段通过', () => {
    const r = validateNetworkLinkFields({
      sourceDeviceId: 1, targetDeviceId: 2,
      sourcePort: 'Gig1/0/1', targetPort: 'Gig0/1',
      linkType: '上联', remark: '核心→接入',
    })
    expect(r.errors).toEqual([])
    expect(r.data.sourceDeviceId).toBe(1)
    expect(r.data.targetDeviceId).toBe(2)
    expect(r.data.linkType).toBe('上联')
  })

  // —— sourceDeviceId 严格校验 ——
  it('sourceDeviceId 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: true }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: false }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 对象拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: { id: 1 } }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 数组拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: [1] }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 空串拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: '' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: '  ' }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 小数拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: 1.5 }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 非安全整数拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: Number.MAX_SAFE_INTEGER + 1 }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 零/负数拒绝', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: 0 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: -1 }).errors.length).toBeGreaterThan(0)
  })

  it('sourceDeviceId 合法正整数通过', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: 1 }).errors).toEqual([])
  })

  // —— targetDeviceId 严格校验 ——
  it('targetDeviceId 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: true }).errors.length).toBeGreaterThan(0)
  })

  it('targetDeviceId 对象拒绝', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: {} }).errors.length).toBeGreaterThan(0)
  })

  it('targetDeviceId 数组拒绝', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: [] }).errors.length).toBeGreaterThan(0)
  })

  it('targetDeviceId 小数拒绝', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: 2.5 }).errors.length).toBeGreaterThan(0)
  })

  it('targetDeviceId 合法正整数通过', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: 2 }).errors).toEqual([])
  })

  // —— linkType 枚举校验 ——
  it('linkType 非法枚举报错', () => {
    expect(validateNetworkLinkFields({ linkType: '下联' }).errors.length).toBeGreaterThan(0)
  })

  it('linkType 合法枚举通过', () => {
    for (const t of ['上联', '级联', '直连', '其他']) {
      expect(validateNetworkLinkFields({ linkType: t }).errors).toEqual([])
    }
  })

  it('linkType 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ linkType: true }).errors.length).toBeGreaterThan(0)
  })

  it('linkType 对象拒绝', () => {
    expect(validateNetworkLinkFields({ linkType: { a: 1 } }).errors.length).toBeGreaterThan(0)
  })

  // —— 文本字段严格校验（sourcePort / targetPort / remark） ——
  it('sourcePort 对象拒绝', () => {
    expect(validateNetworkLinkFields({ sourcePort: { x: 1 } }).errors.length).toBeGreaterThan(0)
  })

  it('sourcePort 数组拒绝', () => {
    expect(validateNetworkLinkFields({ sourcePort: ['a'] }).errors.length).toBeGreaterThan(0)
  })

  it('sourcePort 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ sourcePort: true }).errors.length).toBeGreaterThan(0)
  })

  it('targetPort 对象拒绝', () => {
    expect(validateNetworkLinkFields({ targetPort: {} }).errors.length).toBeGreaterThan(0)
  })

  it('targetPort 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ targetPort: false }).errors.length).toBeGreaterThan(0)
  })

  it('remark 对象拒绝', () => {
    expect(validateNetworkLinkFields({ remark: { x: 1 } }).errors.length).toBeGreaterThan(0)
  })

  it('remark 数组拒绝', () => {
    expect(validateNetworkLinkFields({ remark: [] }).errors.length).toBeGreaterThan(0)
  })

  it('remark 布尔拒绝', () => {
    expect(validateNetworkLinkFields({ remark: true }).errors.length).toBeGreaterThan(0)
  })

  // —— 文本字段合法值 ——
  it('文本字段 trim 前后空格', () => {
    const r = validateNetworkLinkFields({
      sourcePort: '  GE1  ', targetPort: '  ', remark: '  备注  ',
    })
    expect(r.data.sourcePort).toBe('GE1')
    expect(r.data.targetPort).toBe('')
    expect(r.data.remark).toBe('备注')
  })

  it('未知字段被白名单过滤', () => {
    const r = validateNetworkLinkFields({ sourceDeviceId: 1, unknownField: 'x' })
    expect(r.data.unknownField).toBeUndefined()
  })
})

// =====================
// checkSelfConnection
// =====================
describe('checkSelfConnection', () => {
  it('source === target 时报错', () => {
    expect(checkSelfConnection(1, 1)).not.toBeNull()
    expect(checkSelfConnection(100, 100)).not.toBeNull()
  })

  it('source !== target 时通过', () => {
    expect(checkSelfConnection(1, 2)).toBeNull()
    expect(checkSelfConnection(2, 1)).toBeNull()
  })
})

// =====================
// checkReverseDuplicate
// =====================
describe('checkReverseDuplicate', () => {
  const existing = [
    { sourceDeviceId: 1, targetDeviceId: 2 },
    { sourceDeviceId: 3, targetDeviceId: 4 },
  ]

  it('新建 A→B 但已存在 B→A 时报错', () => {
    expect(checkReverseDuplicate(existing, 2, 1)).not.toBeNull()
  })

  it('新建 A→B 且不存在 B→A 时通过', () => {
    expect(checkReverseDuplicate(existing, 3, 4)).toBeNull()
    expect(checkReverseDuplicate(existing, 1, 3)).toBeNull()
  })

  it('新建与已有同方向不算反方向重复', () => {
    expect(checkReverseDuplicate(existing, 1, 2)).toBeNull()
  })
})

// =====================
// checkSameDirectionDuplicate
// =====================
describe('checkSameDirectionDuplicate', () => {
  const existing = [
    { sourceDeviceId: 1, targetDeviceId: 2, sourcePort: 'Gig1/0/1', targetPort: 'Gig0/1' },
  ]

  it('完全相同（含端口）时报错', () => {
    expect(checkSameDirectionDuplicate(existing, 1, 2, 'Gig1/0/1', 'Gig0/1')).not.toBeNull()
  })

  it('端口不同时不算同方向重复', () => {
    expect(checkSameDirectionDuplicate(existing, 1, 2, 'Gig1/0/2', 'Gig0/1')).toBeNull()
    expect(checkSameDirectionDuplicate(existing, 1, 2, 'Gig1/0/1', 'Gig0/2')).toBeNull()
  })

  it('设备对不同时不算同方向重复', () => {
    expect(checkSameDirectionDuplicate(existing, 2, 1, 'Gig1/0/1', 'Gig0/1')).toBeNull()
    expect(checkSameDirectionDuplicate(existing, 3, 4, 'Gig1/0/1', 'Gig0/1')).toBeNull()
  })
})

// =====================
// mapLinkApiError
// =====================
describe('mapLinkApiError', () => {
  it('P2002 唯一冲突 → 409', () => {
    expect(mapLinkApiError({ code: 'P2002' })?.statusCode).toBe(409)
  })

  it('P2003 外键冲突 → 404', () => {
    expect(mapLinkApiError({ code: 'P2003' })?.statusCode).toBe(404)
    expect(mapLinkApiError({ code: 'P2003' })?.message).toContain('不存在')
  })

  it('P2025 记录不存在 → 404', () => {
    expect(mapLinkApiError({ code: 'P2025' })?.statusCode).toBe(404)
    expect(mapLinkApiError({ code: 'P2025' })?.message).toContain('连接关系')
  })

  it('未知错误 → null', () => {
    expect(mapLinkApiError({ code: 'P1001' })).toBeNull()
    expect(mapLinkApiError(new Error('boom'))).toBeNull()
  })
})

// =====================
// isRetryableConcurrencyError
// =====================
describe('isRetryableConcurrencyError', () => {
  it('P2028 事务超时 → 可重试', () => {
    expect(isRetryableConcurrencyError({ code: 'P2028' })).toBe(true)
  })

  it('P2034 死锁 → 可重试', () => {
    expect(isRetryableConcurrencyError({ code: 'P2034' })).toBe(true)
  })

  it('Deadlock 消息 → 可重试', () => {
    expect(isRetryableConcurrencyError({ code: 'unknown', message: 'Deadlock found when trying to get lock' })).toBe(true)
  })

  it('Lock wait timeout 消息 → 可重试', () => {
    expect(isRetryableConcurrencyError({ message: 'Lock wait timeout exceeded' })).toBe(true)
  })

  it('Serialization failure 消息 → 可重试', () => {
    expect(isRetryableConcurrencyError({ message: 'Serialization failure: 1213' })).toBe(true)
  })

  it('非并发错误 → 不可重试', () => {
    expect(isRetryableConcurrencyError({ code: 'P2002' })).toBe(false)
    expect(isRetryableConcurrencyError(new Error('validation error'))).toBe(false)
    expect(isRetryableConcurrencyError(null)).toBe(false)
    expect(isRetryableConcurrencyError(undefined)).toBe(false)
  })
})
