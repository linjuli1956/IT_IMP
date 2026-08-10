/**
 * serverVisualTone 统一视觉映射 单元测试
 */
import { describe, it, expect } from 'vitest'
import { serverVisualTone, platformOf, serverToneClass } from './server-visual-tone'

describe('platformOf', () => {
  it('PVE/ESXi 归一化（大小写不敏感）', () => {
    expect(platformOf({ hypervisor: 'PVE' })).toBe('PVE')
    expect(platformOf({ hypervisor: 'pve' })).toBe('PVE')
    expect(platformOf({ hypervisor: 'esxi' })).toBe('ESXi')
    expect(platformOf({ hypervisor: 'VMware ESXi' })).toBe('ESXi')
    expect(platformOf({ hypervisor: null })).toBeNull()
    expect(platformOf({})).toBeNull()
  })
})

describe('serverVisualTone（物理机按平台/云厂/本地）', () => {
  it('PVE 物理机 → 蓝体系', () => {
    const r = serverVisualTone({ isVirtual: false, hypervisor: 'PVE', serverType: '本地' })
    expect(r.tone).toBe('pve')
    expect(r.platform).toBe('PVE')
  })
  it('ESXi 物理机 → 橙体系', () => {
    expect(serverVisualTone({ isVirtual: false, hypervisor: 'ESXi' }).tone).toBe('esxi')
  })
  it('云厂商/本地物理机 → 各自色系', () => {
    expect(serverVisualTone({ isVirtual: false, serverType: '阿里云' }).tone).toBe('aliyun')
    expect(serverVisualTone({ isVirtual: false, serverType: '腾讯云' }).tone).toBe('tencent')
    expect(serverVisualTone({ isVirtual: false, serverType: '华为云' }).tone).toBe('huawei')
    expect(serverVisualTone({ isVirtual: false, serverType: '本地' }).tone).toBe('local')
  })
})

describe('serverVisualTone（虚拟机按平台继承）', () => {
  it('PVE VM → 蓝体系', () => {
    expect(serverVisualTone({ isVirtual: true, hypervisor: 'PVE' }).tone).toBe('pve')
  })
  it('ESXi VM → 橙体系', () => {
    expect(serverVisualTone({ isVirtual: true, hypervisor: 'ESXi' }).tone).toBe('esxi')
  })
  it('无平台 VM → other（不伪造颜色）', () => {
    expect(serverVisualTone({ isVirtual: true, hypervisor: null }).tone).toBe('other')
  })
})

describe('serverToneClass', () => {
  it('生成 server-tone-* class', () => {
    expect(serverToneClass({ isVirtual: false, hypervisor: 'PVE' })).toBe('server-tone-pve')
    expect(serverToneClass({ isVirtual: false, serverType: '本地' })).toBe('server-tone-local')
  })
})
