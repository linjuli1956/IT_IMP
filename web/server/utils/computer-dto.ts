/**
 * 电脑 DTO：字段白名单、严格校验、可空文本清洗、统一序列化
 */
import { ASSET_STATUS_VALUES } from './network-device-dto'
import {
  INVALID_VALUE, normalizeNullableText, isValidDateString, parseNonNegativeInt,
} from './common-dto'

/** 硬盘类型枚举 */
export const COMPUTER_DISK_TYPES = ['SSD', 'HDD', 'SSD+HDD'] as const

/** 可更新字段白名单 */
export const COMPUTER_FIELDS = [
  'storeId', 'assetNo', 'department', 'brand', 'model', 'serialNo', 'user',
  'cpuModel', 'cpuCores', 'memoryGB', 'diskSizeGB', 'diskType', 'ipAddress',
  'macAddress', 'os', 'osVersion', 'purchaseDate', 'warrantyEndDate', 'status', 'remark',
] as const

/** 可空文本字段 */
const NULLABLE_TEXT_FIELDS = new Set([
  'assetNo', 'department', 'brand', 'model', 'serialNo', 'user', 'cpuModel',
  'diskType', 'ipAddress', 'macAddress', 'os', 'osVersion',
])

export interface ComputerFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/** 按白名单严格校验并清洗电脑请求体（POST/PUT 共用） */
export function validateComputerFields(body: Record<string, unknown>): ComputerFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of COMPUTER_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'storeId': {
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < 1) { errors.push('storeId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'cpuCores':
      case 'memoryGB':
      case 'diskSizeGB': {
        const n = parseNonNegativeInt(value)
        if (n === INVALID_VALUE) { errors.push(`${key} 必须是非负安全整数`); break }
        data[key] = n
        break
      }
      case 'purchaseDate':
      case 'warrantyEndDate': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push(`${key} 必须是字符串`); break }
        if (s === null) { data[key] = null; break }
        if (!isValidDateString(s)) { errors.push(`${key} 必须是有效日期 YYYY-MM-DD`); break }
        // Prisma 7 要求完整 ISO-8601/Date 对象；转 Date 避免 "premature end of input"
        data[key] = new Date(`${s}T00:00:00`)
        break
      }
      case 'diskType': {
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('diskType 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!COMPUTER_DISK_TYPES.includes(s as never)) {
          errors.push(`diskType 只允许 ${COMPUTER_DISK_TYPES.join('/')}`)
          break
        }
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

/** 业务日期格式化为 YYYY-MM-DD（Prisma Date → 前端约定格式） */
function fmtDate(v: unknown): string | null {
  if (v == null) return null
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 电脑 DTO 序列化：DATE→YYYY-MM-DD、store 只留 storeName（列表/详情/POST/PUT 复用） */
export function serializeComputer(c: Record<string, any>): Record<string, any> {
  return {
    ...c,
    purchaseDate: fmtDate(c.purchaseDate),
    warrantyEndDate: fmtDate(c.warrantyEndDate),
    storeName: c.store?.name ?? null,
    store: undefined,
  }
}

/** 电脑 API 错误映射 */
export function mapComputerApiError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') return { statusCode: 409, message: '资产编号/序列号/MAC 与已有记录重复' }
  if (code === 'P2003') return { statusCode: 409, message: '所选门店不存在' }
  if (code === 'P2025') return { statusCode: 404, message: '电脑记录不存在' }
  return null
}
