/**
 * 服务器统计口径 单元测试
 * 覆盖：仅 status=正常；空日期不参与；已过期/今天到期/正好 30·90 天边界；自然日（0 点）。
 */
import { describe, it, expect } from 'vitest'
import { buildServerStatsQueries, daysFromNow, EXPIRE_SOON_DAYS, WARRANTY_DAYS } from './server-stats'

/** 固定"当前时间"：2026-08-07 10:00（自然日边界以当日 0 点为基准） */
const NOW = new Date('2026-08-07T10:00:00+08:00')

describe('daysFromNow', () => {
  it('返回当日 0 点 + N 天', () => {
    expect(daysFromNow(0, NOW).getHours()).toBe(0)
    expect(daysFromNow(30, NOW).getDate()).toBe(6)   // 08-07 + 30 = 09-06
    expect(daysFromNow(30, NOW).getMonth()).toBe(8)  // 9 月
  })
})

describe('buildServerStatsQueries 口径', () => {
  const q = buildServerStatsQueries(NOW)

  it('物理机/虚拟机仅统计 status=正常', () => {
    expect(q.physical).toEqual({ isVirtual: false, status: '正常' })
    expect(q.virtual).toEqual({ isVirtual: true, status: '正常' })
  })

  it('即将到期：空日期不参与（not: null）且阈值=今日+30 天', () => {
    expect(q.expiringSoon.expireDate.not).toBeNull()
    expect(q.expiringSoon.expireDate.lte).toEqual(daysFromNow(EXPIRE_SOON_DAYS, NOW))
  })

  it('保修到期：阈值=今日+90 天', () => {
    expect(q.warranty.warrantyEndDate.lte).toEqual(daysFromNow(WARRANTY_DAYS, NOW))
  })
})

describe('自然日边界（expiringSoon 阈值语义）', () => {
  const threshold = buildServerStatsQueries(NOW).expiringSoon.expireDate.lte

  const inRange = (dateStr: string) => new Date(`${dateStr}T00:00:00`) <= threshold

  it('已过期计入', () => { expect(inRange('2026-01-01')).toBe(true) })
  it('今天到期计入', () => { expect(inRange('2026-08-07')).toBe(true) })
  it('正好 30 天（09-06）计入', () => { expect(inRange('2026-09-06')).toBe(true) })
  it('第 31 天（09-07）不计入', () => { expect(inRange('2026-09-07')).toBe(false) })
})

describe('自然日边界（warranty 阈值语义）', () => {
  const threshold = buildServerStatsQueries(NOW).warranty.warrantyEndDate.lte

  it('正好 90 天（11-05）计入', () => { expect(new Date('2026-11-05T00:00:00') <= threshold).toBe(true) })
  it('第 91 天（11-06）不计入', () => { expect(new Date('2026-11-06T00:00:00') <= threshold).toBe(false) })
  it('已过期计入', () => { expect(new Date('2025-12-31T00:00:00') <= threshold).toBe(true) })
})
