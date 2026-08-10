/**
 * 固话 DTO：字段白名单、严格校验、可空文本清洗、统一序列化
 */
import { ASSET_STATUS_VALUES } from './network-device-dto'
import {
  INVALID_VALUE, normalizeNullableText, normalizeRequiredText, parseNonNegativeDecimal,
} from './common-dto'

/** 运营商枚举 */
export const PHONE_CARRIERS = ['电信', '移动', '联通', '其他'] as const

/** 可更新字段白名单 */
export const PHONE_FIELDS = [
  'storeId', 'department', 'phoneNumber', 'extension', 'carrier',
  'monthlyFee', 'packageInfo', 'user', 'installLocation', 'status', 'remark',
] as const

/** 可空文本字段 */
const NULLABLE_TEXT_FIELDS = new Set(['department', 'extension', 'carrier', 'packageInfo', 'user', 'installLocation'])

export interface PhoneFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/** 按白名单严格校验并清洗固话请求体（POST/PUT 共用） */
export function validatePhoneFields(body: Record<string, unknown>): PhoneFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of PHONE_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'storeId': {
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < 1) { errors.push('storeId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'phoneNumber': {
        // 必填：null/对象/数组/空串 → 400；不写入字符串 "null" / "[object Object]"
        const s = normalizeRequiredText(value)
        if (s === INVALID_VALUE) { errors.push('phoneNumber 必填且为字符串'); break }
        data[key] = s
        break
      }
      case 'carrier': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('carrier 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!PHONE_CARRIERS.includes(s as never)) {
          errors.push(`carrier 只允许 ${PHONE_CARRIERS.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      case 'monthlyFee': {
        // DECIMAL(10,2)：最大 99999999.99，最多 2 位小数
        const n = parseNonNegativeDecimal(value, { max: 99999999.99, decimals: 2 })
        if (n === INVALID_VALUE) { errors.push('monthlyFee 必须是非负数字，最大 99999999.99 且最多 2 位小数'); break }
        data[key] = n
        break
      }
      case 'status': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE || s === null || !ASSET_STATUS_VALUES.includes(s as never)) {
          errors.push(`status 只允许 ${ASSET_STATUS_VALUES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      default: {
        if (NULLABLE_TEXT_FIELDS.has(key)) {
          const s = normalizeNullableText(value)
          if (s === INVALID_VALUE) { errors.push(`${key} 必须是字符串`); break }
          data[key] = s
          break
        }
        data[key] = value
      }
    }
  }

  return { data, errors }
}

/** 固话 DTO 序列化：Decimal→number、store 只留 storeName（列表/详情/POST/PUT 复用） */
export function serializePhone(p: Record<string, any>): Record<string, any> {
  return {
    ...p,
    monthlyFee: p.monthlyFee != null ? Number(p.monthlyFee) : null,
    storeName: p.store?.name ?? null,
    store: undefined,
  }
}

/** 固话 API 错误映射 */
export function mapPhoneApiError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') return { statusCode: 409, message: '固话号码与已有记录重复' }
  if (code === 'P2003') return { statusCode: 409, message: '所选门店不存在' }
  if (code === 'P2025') return { statusCode: 404, message: '固话记录不存在' }
  return null
}
