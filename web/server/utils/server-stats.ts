/**
 * 服务器统计查询条件构建（纯函数，可单测）
 * 口径：仅统计 status=正常 的资产（与需求文档 §9/§10 一致）；
 *       expireDate ≤ 今日+30 天（含已过期）计入即将到期；
 *       warrantyEndDate ≤ 今日+90 天（含已过期）计入保修到期。
 */

/** 距 now 指定天数的日期（当天 0 点） */
export function daysFromNow(days: number, now = new Date()): Date {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  d.setHours(0, 0, 0, 0)
  return d
}

/** 即将到期阈值（天） */
export const EXPIRE_SOON_DAYS = 30
/** 保修到期阈值（天） */
export const WARRANTY_DAYS = 90

/** 统计查询的 where 集合 */
export interface ServerStatsQueries {
  physical: { isVirtual: boolean; status: string }
  virtual: { isVirtual: boolean; status: string }
  expiringSoon: { status: string; expireDate: { not: null; lte: Date } }
  warranty: { status: string; warrantyEndDate: { not: null; lte: Date } }
}

/** 构建 stats 四个查询的 where（可注入 now 便于测试自然日边界） */
export function buildServerStatsQueries(now = new Date()): ServerStatsQueries {
  return {
    physical: { isVirtual: false, status: '正常' },
    virtual: { isVirtual: true, status: '正常' },
    expiringSoon: { status: '正常', expireDate: { not: null, lte: daysFromNow(EXPIRE_SOON_DAYS, now) } },
    warranty: { status: '正常', warrantyEndDate: { not: null, lte: daysFromNow(WARRANTY_DAYS, now) } },
  }
}
