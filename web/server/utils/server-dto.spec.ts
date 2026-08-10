/**
 * 服务器 DTO 校验与清洗 单元测试
 * 覆盖审计复核要求：可空唯一字段空串→NULL（防唯一索引冲突）、非法参数严格报错（不静默转换）、日期真实性。
 */
import { describe, it, expect } from 'vitest'
import { validateServerFields, parsePagination, validateVmHypervisor } from './server-dto'
import { isValidDateString } from './common-dto'
import { parsePositiveSafeId } from './request-validation'

describe('parsePositiveSafeId', () => {
  it('合法正整数通过', () => {
    expect(parsePositiveSafeId('42')).toBe(42)
    expect(parsePositiveSafeId(1)).toBe(1)
  })

  it('非法值抛 400（abc/0/负数/小数/超安全整数）', () => {
    for (const bad of ['abc', '0', '-1', '1.5', String(Number.MAX_SAFE_INTEGER + 1)]) {
      expect(() => parsePositiveSafeId(bad)).toThrow()
    }
  })
})

describe('parsePagination 严格参数', () => {
  it('合法正整数通过', () => {
    expect(parsePagination({ page: '2', pageSize: '50' })).toEqual({ page: 2, pageSize: 50, skip: 50 })
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20, skip: 0 })
  })

  it('pageSize 最大 100（超限截断）', () => {
    expect(parsePagination({ pageSize: '500' }).pageSize).toBe(100)
  })

  it('非法参数抛错（abc/1abc/0/负数/小数）', () => {
    for (const bad of ['abc', '1abc', '0', '-1', '1.5']) {
      expect(() => parsePagination({ page: bad })).toThrow()
      expect(() => parsePagination({ pageSize: bad })).toThrow()
    }
  })

  it('超长数字/非安全整数抛错（不进入 Prisma）', () => {
    expect(() => parsePagination({ page: '9'.repeat(400) })).toThrow()
    expect(() => parsePagination({ pageSize: '9'.repeat(400) })).toThrow()
    expect(() => parsePagination({ page: String(Number.MAX_SAFE_INTEGER + 1) })).toThrow()
  })

  it('skip 乘积溢出抛错（page 安全但乘积非安全整数）', () => {
    expect(() => parsePagination({ page: String(Number.MAX_SAFE_INTEGER), pageSize: '20' })).toThrow()
  })
})

describe('validateServerFields 空字符串→NULL', () => {
  it('serialNo 空字符串统一转为 NULL（连续两条空序列号不会冲突）', () => {
    const r1 = validateServerFields({ name: 'A', serverType: '本地', serialNo: '' })
    const r2 = validateServerFields({ name: 'B', serverType: '本地', serialNo: '' })
    expect(r1.errors).toEqual([])
    expect(r2.errors).toEqual([])
    expect(r1.data.serialNo).toBeNull()
    expect(r2.data.serialNo).toBeNull()
  })

  it('serialNo 空格串也转为 NULL', () => {
    const r = validateServerFields({ serialNo: '   ' })
    expect(r.data.serialNo).toBeNull()
  })

  it('serialNo 有值时原样保留', () => {
    const r = validateServerFields({ serialNo: 'SN-001' })
    expect(r.data.serialNo).toBe('SN-001')
  })
})

describe('validateServerFields 非法参数严格报错', () => {
  it('isVirtual 非法值报错（abc）', () => {
    const r = validateServerFields({ isVirtual: 'abc' })
    expect(r.errors.some(e => e.includes('isVirtual'))).toBe(true)
  })

  it('isVirtual 合法布尔值通过（true/0）', () => {
    expect(validateServerFields({ isVirtual: true }).errors).toEqual([])
    expect(validateServerFields({ isVirtual: '0' }).data.isVirtual).toBe(false)
  })

  it('hostServerId 非法值报错（abc / 1.5 / 0）', () => {
    for (const v of ['abc', 1.5, 0, -1]) {
      const r = validateServerFields({ hostServerId: v })
      expect(r.errors.some(e => e.includes('hostServerId'))).toBe(true)
    }
  })

  it('hostServerId 合法正整数通过', () => {
    const r = validateServerFields({ hostServerId: 3 })
    expect(r.errors).toEqual([])
    expect(r.data.hostServerId).toBe(3)
  })

  it('分配值非法报错（abc / 负数）', () => {
    for (const key of ['cpuCoresAllocated', 'memoryAllocatedGB', 'diskAllocatedGB']) {
      expect(validateServerFields({ [key]: 'abc' }).errors.length).toBeGreaterThan(0)
      expect(validateServerFields({ [key]: -1 }).errors.length).toBeGreaterThan(0)
    }
  })

  it('分配值 0 或空通过', () => {
    expect(validateServerFields({ cpuCoresAllocated: 0 }).errors).toEqual([])
    expect(validateServerFields({ memoryAllocatedGB: '' }).errors).toEqual([])
  })

  it('假日期报错（2026-02-31 / 2026-13-01 / 非标准格式）', () => {
    for (const key of ['expireDate', 'warrantyEndDate']) {
      expect(validateServerFields({ [key]: '2026-02-31' }).errors.length).toBeGreaterThan(0)
      expect(validateServerFields({ [key]: '2026-13-01' }).errors.length).toBeGreaterThan(0)
      expect(validateServerFields({ [key]: '2026/01/01' }).errors.length).toBeGreaterThan(0)
    }
  })

  it('真实日期通过，空串转 NULL', () => {
    expect(validateServerFields({ expireDate: '2026-02-28' }).errors).toEqual([])
    expect(validateServerFields({ expireDate: '' }).data.expireDate).toBeNull()
  })

  it('status 只允许 正常/停用/报废', () => {
    expect(validateServerFields({ status: '启用' }).errors.length).toBeGreaterThan(0)
    expect(validateServerFields({ status: '正常' }).errors).toEqual([])
    expect(validateServerFields({ status: '报废' }).errors).toEqual([])
  })

  it('hypervisor 只允许 PVE/ESXi，空串转 NULL', () => {
    expect(validateServerFields({ hypervisor: 'KVM' }).errors.length).toBeGreaterThan(0)
    expect(validateServerFields({ hypervisor: 'PVE' }).errors).toEqual([])
    expect(validateServerFields({ hypervisor: '' }).data.hypervisor).toBeNull()
  })
})

describe('isValidDateString', () => {
  it('真实日期判定', () => {
    expect(isValidDateString('2026-02-28')).toBe(true)
    expect(isValidDateString('2024-02-29')).toBe(true) // 闰年
    expect(isValidDateString('2026-02-31')).toBe(false)
    expect(isValidDateString('2026-13-01')).toBe(false)
    expect(isValidDateString('2026-00-10')).toBe(false)
    expect(isValidDateString('abc')).toBe(false)
  })
})

describe('manageUrl 校验', () => {
  it('合法 http/https URL 通过', () => {
    const r = validateServerFields({ manageUrl: 'https://192.168.1.10:8006' })
    expect(r.errors).toEqual([])
    expect(r.data.manageUrl).toBe('https://192.168.1.10:8006')
  })
  it('空串/null → null', () => {
    expect(validateServerFields({ manageUrl: '' }).data.manageUrl).toBeNull()
    expect(validateServerFields({ manageUrl: null }).data.manageUrl).toBeNull()
  })
  it('非 http(s) 前缀 → 400', () => {
    expect(validateServerFields({ manageUrl: '192.168.1.10:8006' }).errors.length).toBeGreaterThan(0)
    expect(validateServerFields({ manageUrl: 'ftp://x' }).errors.length).toBeGreaterThan(0)
  })
})

describe('validateVmHypervisor（平台归属：hypervisor 属物理宿主机，VM 继承）', () => {
  it('物理机不校验平台', () => {
    expect(validateVmHypervisor(false, null, 'PVE', null)).toBeNull()
  })
  it('虚拟机必须选择宿主机', () => {
    expect(validateVmHypervisor(true, null, null, null)).toContain('宿主机')
  })
  it('VM 平台与宿主不一致 → 错误', () => {
    expect(validateVmHypervisor(true, 1, 'PVE', 'ESXi')).toContain('ESXi')
    expect(validateVmHypervisor(true, 1, 'ESXi', 'PVE')).toContain('PVE')
  })
  it('VM 平台与宿主一致 → 通过', () => {
    expect(validateVmHypervisor(true, 1, 'PVE', 'PVE')).toBeNull()
    expect(validateVmHypervisor(true, 1, 'ESXi', 'ESXi')).toBeNull()
  })
  it('VM 未提交平台（继承）→ 通过', () => {
    expect(validateVmHypervisor(true, 1, null, 'PVE')).toBeNull()
  })
})

describe('物理机可填 hypervisor（平台归属物理机）', () => {
  it('物理机提交 PVE/ESXi 通过且保留', () => {
    const r = validateServerFields({ isVirtual: false, hypervisor: 'PVE' })
    expect(r.errors).toEqual([])
    expect(r.data.hypervisor).toBe('PVE')
  })
  it('物理机 hypervisor 可为空', () => {
    const r = validateServerFields({ isVirtual: false, hypervisor: null })
    expect(r.errors).toEqual([])
    expect(r.data.hypervisor).toBeNull()
  })
})
