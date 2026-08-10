/**
 * 资产工具 单元测试（新增：预览格式化与敏感过滤）
 * 覆盖：空值显示 —、false/0 正常显示、sensitive 行不渲染（不进 tooltip DOM）。
 */
import { describe, it, expect } from 'vitest'
import { formatPreviewValue, filterSensitiveRows, isEmptyValue, getCalibrationInfo } from './asset-utils'

describe('formatPreviewValue', () => {
  it('空值统一显示 —', () => {
    expect(formatPreviewValue('')).toBe('—')
    expect(formatPreviewValue(null)).toBe('—')
    expect(formatPreviewValue(undefined)).toBe('—')
  })

  it('false 与 0 正常显示（不得被当作空）', () => {
    expect(formatPreviewValue(false)).toBe('false')
    expect(formatPreviewValue(0)).toBe('0')
    expect(isEmptyValue(false)).toBe(false)
    expect(isEmptyValue(0)).toBe(false)
  })

  it('普通值转字符串', () => {
    expect(formatPreviewValue('华为')).toBe('华为')
    expect(formatPreviewValue(24)).toBe('24')
  })
})

describe('filterSensitiveRows', () => {
  it('sensitive 行被过滤（敏感字段不进入 tooltip DOM）', () => {
    const rows = [
      { label: '状态', value: '正常' },
      { label: '密码', value: 'secret', sensitive: true },
      { label: '门店', value: '总店' },
    ]
    const safe = filterSensitiveRows(rows)
    expect(safe).toHaveLength(2)
    expect(safe.map(r => r.label)).toEqual(['状态', '门店'])
    expect(safe.some(r => r.value === 'secret')).toBe(false)
  })

  it('无 sensitive 行时全部保留', () => {
    const rows = [{ label: 'IP', value: '192.168.0.1' }]
    expect(filterSensitiveRows(rows)).toHaveLength(1)
  })
})

describe('getCalibrationInfo', () => {
  const NOW = new Date('2026-08-07T10:00:00')
  it('已逾期显示 已逾期N天（danger）', () => {
    expect(getCalibrationInfo('2026-08-01', '正常', NOW)).toMatchObject({ label: '已逾期6天', tone: 'danger', overdue: true })
  })
  it('今天应校准（danger）', () => {
    expect(getCalibrationInfo('2026-08-07', '正常', NOW).label).toBe('今天应校准')
  })
  it('30 天内 → danger，31~90 天 → warning，>90 天 → info', () => {
    expect(getCalibrationInfo('2026-08-20', '正常', NOW).tone).toBe('danger')
    expect(getCalibrationInfo('2026-09-01', '正常', NOW).tone).toBe('danger')
    expect(getCalibrationInfo('2026-09-10', '正常', NOW).tone).toBe('warning')
    expect(getCalibrationInfo('2026-11-10', '正常', NOW).tone).toBe('info')
  })
  it('30/31、90/91 天自然日边界', () => {
    expect(getCalibrationInfo('2026-09-06', '正常', NOW).tone).toBe('danger')   // 第 30 天
    expect(getCalibrationInfo('2026-09-07', '正常', NOW).tone).toBe('warning')  // 第 31 天
    expect(getCalibrationInfo('2026-11-05', '正常', NOW).tone).toBe('warning')  // 第 90 天
    expect(getCalibrationInfo('2026-11-06', '正常', NOW).tone).toBe('info')     // 第 91 天
  })
  it('空日期与停用/报废不提醒', () => {
    expect(getCalibrationInfo(null, '正常', NOW).label).toBe('—')
    expect(getCalibrationInfo('2026-08-01', '停用', NOW).tone).toBeNull()
    expect(getCalibrationInfo('2026-08-01', '报废', NOW).tone).toBeNull()
  })
})
