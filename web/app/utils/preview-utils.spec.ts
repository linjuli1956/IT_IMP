/**
 * 各模块"记录快速预览"构造 单元测试
 * 覆盖：0 值（0核/0GB）正常显示、空值 → —、行数 ≤8、tone、敏感字段不进 rows。
 */
import { describe, it, expect } from 'vitest'
import {
  buildServerPreviewRows, buildDevicePreviewRows, buildDomainPreviewRows,
  buildMiniappPreviewRows, buildPaymentPreviewRows,
} from './preview-utils'
import type { PreviewRow } from '~/components/common/RecordPreviewTooltip.vue'

function rowValue(rows: PreviewRow[], label: string): unknown {
  return rows.find(r => r.label === label)?.value
}

describe('服务器预览', () => {
  it('虚拟机：0 核/0GB 正常显示（!= null 判断）', () => {
    const rows = buildServerPreviewRows({
      id: 1, name: 'vm', isVirtual: true, hostServerName: 'host',
      cpuCoresAllocated: 0, memoryAllocatedGB: 0, diskAllocatedGB: 0,
      hypervisor: 'PVE', internalIp: '10.0.0.1', os: 'Ubuntu', purpose: '测试',
      expireDate: '2026-12-31', status: '正常',
    } as any)
    expect(rowValue(rows, '分配资源')).toBe('0核 / 0GB / 0GB')
    expect(rows.length).toBeLessThanOrEqual(8)
  })

  it('虚拟机：资源为空显示 —（空值不出现数字）', () => {
    const rows = buildServerPreviewRows({
      id: 2, name: 'vm2', isVirtual: true, cpuCoresAllocated: null,
      memoryAllocatedGB: undefined, diskAllocatedGB: null, status: '正常',
    } as any)
    expect(rowValue(rows, '分配资源')).toBe('')
  })

  it('物理机：虚拟机数量 0 正常显示', () => {
    const rows = buildServerPreviewRows({
      id: 3, name: 'host', isVirtual: false, vmCount: 0,
      manufacturer: '戴尔', model: 'R740', status: '正常',
    } as any)
    expect(rowValue(rows, '平台/虚拟机')).toContain('0台虚拟机')
    expect(rows.length).toBeLessThanOrEqual(8)
  })

  it('状态 tone：正常→success，报废→danger', () => {
    const normal = buildServerPreviewRows({ id: 1, name: 'a', isVirtual: false, status: '正常' } as any)
    const scrap = buildServerPreviewRows({ id: 2, name: 'b', isVirtual: false, status: '报废' } as any)
    expect(normal.find(r => r.label === '状态')?.tone).toBe('success')
    expect(scrap.find(r => r.label === '状态')?.tone).toBe('danger')
  })
})

describe('网络设备预览', () => {
  it('行数 ≤8 且门店/类型/IP 展示', () => {
    const rows = buildDevicePreviewRows({
      id: 1, storeName: '总店', deviceType: '交换机', manageType: '网管型',
      brand: '华为', managementIp: '192.168.1.1', status: '正常',
    } as any)
    expect(rows.length).toBeLessThanOrEqual(8)
    expect(rowValue(rows, '门店')).toBe('总店')
    expect(rowValue(rows, 'IP/MAC')).toBe('192.168.1.1')
  })
})

describe('域名预览', () => {
  it('不含主账号/主账号密码等敏感字段', () => {
    const rows = buildDomainPreviewRows({
      id: 1, domain: 'example.com', mainAccount: 'acc', mainPassword: 'secret',
      certType: 'DV', certIssuer: 'Let\'s Encrypt', certRenewDate: '2026-01-01',
      certExpireDate: '2026-12-31', remark: '备注', status: '正常',
    } as any)
    expect(rows.some(r => r.label.includes('账号') || r.label.includes('密码'))).toBe(false)
    expect(rows.some(r => String(r.value).includes('secret'))).toBe(false)
  })

  it('长备注保留但不超过行数上限', () => {
    const rows = buildDomainPreviewRows({
      id: 1, domain: 'example.com', certExpireDate: '2026-12-31', status: '正常',
      remark: 'x'.repeat(200),
    } as any)
    expect(rows.length).toBeLessThanOrEqual(8)
    expect(rowValue(rows, '备注')).toHaveLength(200)
  })
})

describe('小程序/支付预览', () => {
  it('小程序不含邮箱密码', () => {
    const rows = buildMiniappPreviewRows({ id: 1, name: 'app', email: 'a@b.com', emailPassword: 'secret', status: '正常', remark: '' } as any)
    expect(rows.some(r => String(r.value).includes('secret'))).toBe(false)
  })

  it('支付不含敏感 configValue（即使已解密也不进 rows）', () => {
    const rows = buildPaymentPreviewRows({
      id: 1, storeName: '总店', storeId: 2, payMethod: 'wx', payMethodName: '微信',
      provider: '中国邮政', configName: '密钥', configValue: 'super-secret', posNo: 'P01',
      isSensitive: true, status: '正常',
    } as any)
    expect(rows.some(r => String(r.value).includes('super-secret'))).toBe(false)
    expect(rows.length).toBeLessThanOrEqual(8)
  })
})
