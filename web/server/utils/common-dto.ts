/**
 * 资产 DTO 公共清洗/校验工具（跨 phone/computer/scale 等模块复用）
 */
import { createError } from 'h3'

/** 非法类型哨兵（对象/数组/布尔/数字传入可空文本字段时返回，调用方转 400） */
export const INVALID_VALUE = Symbol('invalid')

/**
 * 可空文本清洗：null/undefined → null；字符串 → trim 后（空串/纯空格 → null）；
 * 其他类型（对象/数组/布尔/数字）→ INVALID_VALUE（禁止 String() 静默转换）。
 */
export function normalizeNullableText(value: unknown): string | null | typeof INVALID_VALUE {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') {
    const s = value.trim()
    return s === '' ? null : s
  }
  return INVALID_VALUE
}

/** 必填字符串清洗：字符串 trim 后非空返回；null/undefined/非字符串/空串 → INVALID_VALUE */
export function normalizeRequiredText(value: unknown): string | typeof INVALID_VALUE {
  if (typeof value === 'string') {
    const s = value.trim()
    return s === '' ? INVALID_VALUE : s
  }
  return INVALID_VALUE
}

/** 校验日期为真实 YYYY-MM-DD */
export function isValidDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const y = Number(m[1]); const mo = Number(m[2]); const d = Number(m[3])
  if (mo < 1 || mo > 12) return false
  const date = new Date(y, mo - 1, d)
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d
}

/**
 * 非负有限数（DECIMAL 用）：null/undefined/空串 → null；必须是有限非负数（拒绝 Infinity/NaN）；
 * 不得超过 max（按字段数据库精度，如 DECIMAL(8,2) 最大 999999.99），且小数位不超过 decimals（默认 2）；
 * 超范围/超小数位返回 INVALID_VALUE（不交给数据库隐式截断或四舍五入）。
 */
export function parseNonNegativeDecimal(
  value: unknown,
  opts: { max: number; decimals?: number } = { max: 99999999.99, decimals: 2 },
): number | null | typeof INVALID_VALUE {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  const n = Number(value)
  if (typeof value === 'boolean') return INVALID_VALUE
  const decimals = opts.decimals ?? 2
  if (!Number.isFinite(n) || n < 0 || n > opts.max) return INVALID_VALUE
  // 小数位校验：乘以 10^decimals 后必须是安全整数（误差容限 1e-8）
  const factor = Math.pow(10, decimals)
  if (Math.abs(n * factor - Math.round(n * factor)) > 1e-8) return INVALID_VALUE
  return n
}

/**
 * 非负安全整数（INT 用）：null/undefined/空串 → null；必须是安全非负整数；范围 < 2^31。
 */
export function parseNonNegativeInt(value: unknown): number | null | typeof INVALID_VALUE {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && value.trim() === '') return null
  if (typeof value === 'boolean') return INVALID_VALUE
  const n = Number(value)
  if (!Number.isSafeInteger(n) || n < 0 || n >= 2147483647) return INVALID_VALUE
  return n
}

/** 通用错误消息辅助：把清洗错误转成中文提示 */
export function fieldError(key: string, message: string): string {
  return `${key}: ${message}`
}
