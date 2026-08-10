/**
 * 服务器虚拟化约束校验 单元测试
 * 覆盖需求文档 §4.2 全部约束：宿主必须物理机/不能自引用/物理机不能有宿主/
 * 虚拟机必须有宿主/宿主存在性/分配值非负。
 */
import { describe, it, expect } from 'vitest'
import { validateServerVirtualization } from './server-validation'

/** 一个物理机宿主 */
const physicalHost = { id: 10, isVirtual: false }
/** 一个虚拟机（不能作宿主） */
const virtualHost = { id: 11, isVirtual: true }

describe('validateServerVirtualization', () => {
  it('物理机：hostServerId 为空时合法', () => {
    const r = validateServerVirtualization({ isVirtual: false, hostServerId: null }, null)
    expect(r.valid).toBe(true)
  })

  it('物理机不能有宿主', () => {
    const r = validateServerVirtualization({ isVirtual: false, hostServerId: 10 }, physicalHost)
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(400)
    expect(r.error).toContain('物理机不能有宿主机')
  })

  it('虚拟机必须指定宿主', () => {
    const r = validateServerVirtualization({ isVirtual: true, hostServerId: null }, null)
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(400)
  })

  it('虚拟机宿主不存在返回 404', () => {
    const r = validateServerVirtualization({ isVirtual: true, hostServerId: 99 }, null)
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(404)
  })

  it('虚拟机宿主必须是物理机（不能挂到虚拟机）', () => {
    const r = validateServerVirtualization({ isVirtual: true, hostServerId: 11 }, virtualHost)
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(400)
    expect(r.error).toContain('宿主机必须是物理机')
  })

  it('不能将自己设为宿主', () => {
    const r = validateServerVirtualization({ id: 5, isVirtual: true, hostServerId: 5 }, physicalHost)
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(400)
    expect(r.error).toContain('不能将自己设为宿主机')
  })

  it('虚拟机挂到物理机时合法', () => {
    const r = validateServerVirtualization({ isVirtual: true, hostServerId: 10 }, physicalHost)
    expect(r.valid).toBe(true)
  })

  it('分配资源为负数时非法', () => {
    const r = validateServerVirtualization(
      { isVirtual: true, hostServerId: 10, cpuCoresAllocated: -1 },
      physicalHost,
    )
    expect(r.valid).toBe(false)
    expect(r.statusCode).toBe(400)
  })

  it('分配资源为 0 或空时合法', () => {
    const r = validateServerVirtualization(
      { isVirtual: true, hostServerId: 10, cpuCoresAllocated: 0, memoryAllocatedGB: null },
      physicalHost,
    )
    expect(r.valid).toBe(true)
  })
})
