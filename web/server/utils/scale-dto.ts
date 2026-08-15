/**
 * 电子称 DTO：字段白名单、严格校验、可空文本清洗、统一序列化、校准筛选
 */
import { ASSET_STATUS_VALUES } from './network-device-dto'
import {
  INVALID_VALUE, normalizeNullableText, isValidDateString, parseNonNegativeDecimal, parseNonNegativeInt,
} from './common-dto'

/** 接口枚举 */
export const SCALE_INTERFACES = ['RS232', 'USB', 'WiFi', '蓝牙'] as const

/** 可更新字段白名单 */
export const SCALE_FIELDS = [
  'storeId', 'assetNo', 'brand', 'model', 'serialNo', 'scaleNo', 'ipAddress',
  'capacityKg', 'precisionG',
  'interface', 'lastCalibrationDate', 'nextCalibrationDate', 'calibrationCycleDays',
  'installLocation', 'status', 'remark',
] as const

/** 可空文本字段 */
const NULLABLE_TEXT_FIELDS = new Set(['assetNo', 'brand', 'model', 'serialNo', 'installLocation'])

/** 合法 IPv4 校验（四段 0-255，不接收前置零如 001） */
function isValidIPv4(s: string): boolean {
  const parts = s.split('.')
  if (parts.length !== 4) return false
  return parts.every(p => {
    if (!/^(0|[1-9]\d{0,2})$/.test(p)) return false
    const n = Number(p)
    return n >= 0 && n <= 255
  })
}

export interface ScaleFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/** 按白名单严格校验并清洗电子称请求体（POST/PUT 共用） */
export function validateScaleFields(body: Record<string, unknown>): ScaleFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of SCALE_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'storeId': {
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < 1) { errors.push('storeId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'capacityKg': {
        // DECIMAL(10,2)：最大 99999999.99
        const n = parseNonNegativeDecimal(value, { max: 99999999.99, decimals: 2 })
        if (n === INVALID_VALUE) { errors.push('capacityKg 必须是非负数字，最大 99999999.99 且最多 2 位小数'); break }
        data[key] = n
        break
      }
      case 'precisionG': {
        // DECIMAL(8,2)：最大 999999.99
        const n = parseNonNegativeDecimal(value, { max: 999999.99, decimals: 2 })
        if (n === INVALID_VALUE) { errors.push('precisionG 必须是非负数字，最大 999999.99 且最多 2 位小数'); break }
        data[key] = n
        break
      }
      case 'calibrationCycleDays': {
        const n = parseNonNegativeInt(value)
        if (n === INVALID_VALUE) { errors.push('calibrationCycleDays 必须是非负安全整数'); break }
        data[key] = n
        break
      }
      case 'lastCalibrationDate':
      case 'nextCalibrationDate': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push(`${key} 必须是字符串`); break }
        if (s === null) { data[key] = null; break }
        if (!isValidDateString(s)) { errors.push(`${key} 必须是有效日期 YYYY-MM-DD`); break }
        // Prisma 7 要求完整 ISO-8601/Date 对象（@db.Date 仅是列类型）；转 Date 避免 "premature end of input"
        data[key] = new Date(`${s}T00:00:00`)
        break
      }
      case 'interface': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('interface 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!SCALE_INTERFACES.includes(s as never)) {
          errors.push(`interface 只允许 ${SCALE_INTERFACES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      case 'scaleNo': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('scaleNo 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (s.length > 50) { errors.push('scaleNo 最长 50 字符'); break }
        data[key] = s
        break
      }
      case 'ipAddress': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('ipAddress 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!isValidIPv4(s)) { errors.push('ipAddress 必须是合法 IPv4 地址（如 192.168.1.1）'); break }
        data[key] = s
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

/** 业务日期格式化为 YYYY-MM-DD */
function fmtDate(v: unknown): string | null {
  if (v == null) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 电子称 DTO 序列化：Decimal→number、DATE→YYYY-MM-DD、storeName（四类响应复用） */
export function serializeScale(s: Record<string, any>): Record<string, any> {
  return {
    ...s,
    capacityKg: s.capacityKg != null ? Number(s.capacityKg) : null,
    precisionG: s.precisionG != null ? Number(s.precisionG) : null,
    lastCalibrationDate: fmtDate(s.lastCalibrationDate),
    nextCalibrationDate: fmtDate(s.nextCalibrationDate),
    storeName: s.store?.name ?? null,
    store: undefined,
  }
}

/** 电子称 API 错误映射 */
export function mapScaleApiError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') {
    const target = (error as { meta?: { target?: string[] } })?.meta?.target
    // Prisma 复合唯一约束可能以 target 数组或索引名出现在 message 中
    const errMsg = String((error as { message?: string })?.message || '')
    if (target?.includes('scaleNo') || errMsg.includes('scaleNo')) {
      return { statusCode: 409, message: '该门店已存在相同秤号' }
    }
    if (target?.includes('assetNo') || errMsg.includes('assetNo')) {
      return { statusCode: 409, message: '资产编号与已有记录重复' }
    }
    if (target?.includes('serialNo') || errMsg.includes('serialNo')) {
      return { statusCode: 409, message: '序列号与已有记录重复' }
    }
    return { statusCode: 409, message: '资产编号/序列号与已有记录重复' }
  }
  if (code === 'P2003') return { statusCode: 409, message: '所选门店不存在' }
  if (code === 'P2025') return { statusCode: 404, message: '电子称记录不存在' }
  return null
}
