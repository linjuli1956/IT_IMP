/**
 * 请求参数校验公共工具（跨模块复用：服务器/网络设备/固话/电脑/电子称等 API）
 */
import { createError } from 'h3'

/** 路由 ID 统一校验：正安全整数，非法抛 400（避免各 API 复制判断） */
export function parsePositiveSafeId(value: unknown, label = 'ID'): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: `无效的${label}` })
  }
  return id
}

/** 请求体必须是普通 JSON 对象：null/数组/字符串/数字/布尔直接 400
 *  （防解构与字段白名单在非对象载荷上失效后触发 500） */
export function ensurePlainObjectBody(body: unknown): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: '请求体必须是 JSON 对象' })
  }
  return body as Record<string, unknown>
}

/** 必填字符串字段：非空字符串，否则 400 */
export function requireStringField(body: Record<string, unknown>, field: string, label: string): string {
  const value = body[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw createError({ statusCode: 400, message: `${label}不能为空` })
  }
  return value
}

/** 可选字符串字段：未提供返回 undefined；提供但非字符串 → 400
 *  （禁止对象/数组/布尔被 Prisma 隐式处理） */
export function optionalStringField(body: Record<string, unknown>, field: string, label: string): string | undefined {
  const value = body[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    throw createError({ statusCode: 400, message: `${label}必须是字符串` })
  }
  return value
}

/** 更新字段定义（pickStringUpdateFields 用） */
export interface UpdateFieldSpec {
  key: string
  label: string
  /** 敏感字段：空值（null/''）视为"不修改"，不落库 */
  sensitive?: boolean
}

/** 按白名单挑选字符串更新字段（更新接口不直接 data: body）：
 *  - 未提供（undefined）→ 跳过
 *  - 敏感字段空值（null/''）→ 跳过 = "不修改"（防误清空已保存凭据）
 *  - 类型非字符串 → 400（未知字段/ID 不进白名单即被丢弃） */
export function pickStringUpdateFields(
  body: Record<string, unknown>,
  fields: readonly UpdateFieldSpec[],
): Record<string, string> {
  const data: Record<string, string> = {}
  for (const { key, label, sensitive } of fields) {
    const value = body[key]
    if (value === undefined) continue
    if (sensitive && (value === null || value === '')) continue
    if (typeof value !== 'string') {
      throw createError({ statusCode: 400, message: `${label}必须是字符串` })
    }
    data[key] = value
  }
  return data
}
