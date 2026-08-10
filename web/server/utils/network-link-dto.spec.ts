/**
 * 网络设备连接关系 DTO 校验 单元测试
 * 覆盖：字段校验、自连接、反方向重复、同方向重复、错误映射。
 */
import { describe, it, expect } from 'vitest'
import {
  validateNetworkLinkFields,
  checkSelfConnection,
  checkReverseDuplicate,
  checkSameDirectionDuplicate,
  mapLinkApiError,
} from './network-link-dto'

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

  it('sourceDeviceId 非正整数报错', () => {
    expect(validateNetworkLinkFields({ sourceDeviceId: 0 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: 'abc' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: 1.5 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ sourceDeviceId: 1 }).errors).toEqual([])
  })

  it('targetDeviceId 非正整数报错', () => {
    expect(validateNetworkLinkFields({ targetDeviceId: 0 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ targetDeviceId: -1 }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ targetDeviceId: 2 }).errors).toEqual([])
  })

  it('linkType 非法枚举报错', () => {
    expect(validateNetworkLinkFields({ linkType: '下联' }).errors.length).toBeGreaterThan(0)
    expect(validateNetworkLinkFields({ linkType: '上联' }).errors).toEqual([])
    expect(validateNetworkLinkFields({ linkType: '级联' }).errors).toEqual([])
    expect(validateNetworkLinkFields({ linkType: '直连' }).errors).toEqual([])
    expect(validateNetworkLinkFields({ linkType: '其他' }).errors).toEqual([])
  })

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

describe('checkReverseDuplicate', () => {
  const existing = [
    { sourceDeviceId: 1, targetDeviceId: 2 },
    { sourceDeviceId: 3, targetDeviceId: 4 },
  ]

  it('新建 A→B 但已存在 B→A 时报错', () => {
    // 已有 1→2，新建 2→1 → 应报错
    expect(checkReverseDuplicate(existing, 2, 1)).not.toBeNull()
  })

  it('新建 A→B 且不存在 B→A 时通过', () => {
    // 已有 1→2，新建 3→4 → 通过
    expect(checkReverseDuplicate(existing, 3, 4)).toBeNull()
    // 已有 1→2，新建 1→3 → 通过（不同 target）
    expect(checkReverseDuplicate(existing, 1, 3)).toBeNull()
  })

  it('新建与已有同方向不算反方向重复', () => {
    // 已有 1→2，新建 1→2 → 不是反方向重复（同方向重复由另一函数检查）
    expect(checkReverseDuplicate(existing, 1, 2)).toBeNull()
  })
})

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
