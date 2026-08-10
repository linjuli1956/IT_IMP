/**
 * 服务器 DTO 工具：敏感字段剔除、分页解析、字段白名单、严格校验与清洗
 * 供 servers API 统一使用：
 * - 列表/详情不返回密码；
 * - 非法参数返回 400（不静默转换）；
 * - 可空唯一字段空字符串统一转 NULL。
 */
import { createError } from 'h3'
import { isValidDateString, normalizeNullableText, INVALID_VALUE } from './common-dto'

/** 剔除敏感字段（password/dbPassword），并序列化 Decimal 为 number */
export function toSafeServer<T extends Record<string, unknown>>(server: T): Omit<T, 'password' | 'dbPassword'> {
  const { password: _p, dbPassword: _d, ...rest } = server
  const safe = rest as Record<string, unknown>
  // Prisma Decimal → number（内存/磁盘分配值）
  if (safe.memoryAllocatedGB != null) safe.memoryAllocatedGB = Number(safe.memoryAllocatedGB)
  if (safe.diskAllocatedGB != null) safe.diskAllocatedGB = Number(safe.diskAllocatedGB)
  return safe as Omit<T, 'password' | 'dbPassword'>
}

/** 分页参数严格解析：page/pageSize 必须为完整正整数（拒绝 abc/1abc/0/负数/小数），pageSize 最大 100 */
const PAGE_PATTERN = /^[1-9]\d*$/
export function parsePagination(
  query: Record<string, unknown>,
  defaultPageSize = 20,
  maxPageSize = 100,
): { page: number; pageSize: number; skip: number } {
  const pageRaw = query.page === undefined || query.page === null || query.page === '' ? undefined : String(query.page)
  if (pageRaw !== undefined && !PAGE_PATTERN.test(pageRaw)) {
    throw createError({ statusCode: 400, message: 'page 必须是正整数' })
  }
  const sizeRaw = query.pageSize === undefined || query.pageSize === null || query.pageSize === '' ? undefined : String(query.pageSize)
  if (sizeRaw !== undefined && !PAGE_PATTERN.test(sizeRaw)) {
    throw createError({ statusCode: 400, message: 'pageSize 必须是正整数' })
  }

  const page = pageRaw ? Number(pageRaw) : 1
  if (!Number.isSafeInteger(page) || page < 1) {
    throw createError({ statusCode: 400, message: 'page 必须是不小于 1 的安全整数' })
  }
  const rawSize = sizeRaw ? Number(sizeRaw) : defaultPageSize
  if (!Number.isSafeInteger(rawSize) || rawSize < 1) {
    throw createError({ statusCode: 400, message: 'pageSize 必须是不小于 1 的安全整数' })
  }
  const pageSize = Math.min(maxPageSize, rawSize)
  const skip = (page - 1) * pageSize
  // 乘积可能超出安全整数（如 page=MAX_SAFE_INTEGER, pageSize=20），必须拒绝，不能进入 Prisma
  if (!Number.isSafeInteger(skip) || skip < 0) {
    throw createError({ statusCode: 400, message: '分页参数过大' })
  }
  return { page, pageSize, skip }
}

/** 服务器状态枚举（与需求文档 §九 一致） */
export const SERVER_STATUS_VALUES = ['正常', '停用', '报废'] as const

/** 虚拟化平台枚举（空=无） */
export const HYPERVISOR_VALUES = ['PVE', 'ESXi'] as const

/**
 * 校验虚拟机平台与宿主机一致（业务规则：hypervisor 归属物理宿主机，VM 必须继承）。
 * 返回错误信息或 null（通过）。
 */
export function validateVmHypervisor(
  isVirtual: boolean | null | undefined,
  hostServerId: number | null | undefined,
  submittedHypervisor: string | null | undefined,
  hostHypervisor: string | null | undefined,
): string | null {
  if (!isVirtual) return null
  if (!hostServerId) return '虚拟机必须选择宿主机'
  if (submittedHypervisor && hostHypervisor && submittedHypervisor !== hostHypervisor) {
    return `虚拟化平台必须与宿主机一致（宿主机为 ${hostHypervisor}）`
  }
  return null
}

/** YYYY-MM-DD 且为真实存在的日期 */
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * 严格解析布尔：true/'true'/'1'/1 → true；false/'false'/'0'/0 → false；其余返回 undefined（非法）
 */
export function parseBooleanStrict(value: unknown): boolean | undefined {
  if (value === true || value === 'true' || value === '1' || value === 1) return true
  if (value === false || value === 'false' || value === '0' || value === 0) return false
  return undefined
}

/** 严格解析正整数（>=1）：空 → null；非正整数 → undefined（非法） */
export function parsePositiveIntStrict(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (!Number.isInteger(n) || n < 1) return undefined
  return n
}

/** 严格解析非负小数：空 → null；非法 → undefined */
export function parseNonNegativeNumberStrict(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  if (Number.isNaN(n) || n < 0) return undefined
  return n
}

/** 服务器可更新字段白名单（**不含 password/dbPassword**，密码走独立接口） */
export const SERVER_EDITABLE_FIELDS = [
  'name', 'serverType', 'cloudAccount', 'internalIp', 'externalIp', 'port',
  'cpuModel', 'cpuCores', 'memorySize', 'systemDiskSize', 'dataDiskSize',
  'diskType', 'os', 'expireDate', 'purpose', 'account', 'dbAccount', 'dbPort',
  'remark', 'status', 'manufacturer', 'model', 'serialNo', 'raidType',
  'networkCards', 'warrantyEndDate', 'isVirtual', 'hypervisor', 'hostServerId',
  'cpuCoresAllocated', 'memoryAllocatedGB', 'diskAllocatedGB', 'manageUrl',
] as const

export type ServerEditableField = (typeof SERVER_EDITABLE_FIELDS)[number]

/** 校验结果：data 为清洗后可直接写库的字段；errors 非空时调用方应返回 400 */
export interface ServerFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/**
 * 按白名单严格校验并清洗请求体字段（POST/PUT 共用）。
 * 规则：可空唯一字符串字段空串 → null；布尔/整数/小数/日期/status/hypervisor 非法值计入 errors。
 */
export function validateServerFields(body: Record<string, unknown>): ServerFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of SERVER_EDITABLE_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'expireDate':
      case 'warrantyEndDate': {
        if (value === null) { data[key] = null; break }
        const s = String(value).trim()
        if (s === '') { data[key] = null; break }
        if (!isValidDateString(s)) { errors.push(`${key} 必须是有效日期 YYYY-MM-DD`); break }
        // Prisma 7 要求完整 ISO-8601/Date 对象（@db.Date 仅是列类型）；转 Date 避免 "premature end of input"
        data[key] = new Date(`${s}T00:00:00`)
        break
      }
      case 'isVirtual': {
        const b = parseBooleanStrict(value)
        if (b === undefined) { errors.push('isVirtual 必须是布尔值'); break }
        data[key] = b
        break
      }
      case 'hostServerId': {
        const n = parsePositiveIntStrict(value)
        if (n === undefined) { errors.push('hostServerId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'cpuCoresAllocated':
      case 'memoryAllocatedGB':
      case 'diskAllocatedGB': {
        const n = parseNonNegativeNumberStrict(value)
        if (n === undefined) { errors.push(`${key} 必须是非负数字`); break }
        data[key] = n
        break
      }
      case 'status': {
        const s = String(value).trim()
        if (!SERVER_STATUS_VALUES.includes(s as never)) { errors.push(`status 只允许 ${SERVER_STATUS_VALUES.join('/')}`); break }
        data[key] = s
        break
      }
      case 'hypervisor': {
        // null/undefined/空串 → null（String(null) 会变 "null" 导致误报）
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('hypervisor 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!HYPERVISOR_VALUES.includes(s as never)) { errors.push(`hypervisor 只允许 ${HYPERVISOR_VALUES.join('/')}`); break }
        data[key] = s
        break
      }
      case 'manageUrl': {
        // 管理地址：可空；填写时必须 http(s):// 开头
        const s = normalizeNullableText(value)
        if (s === INVALID_VALUE) { errors.push('manageUrl 必须是字符串'); break }
        if (s === null) { data[key] = null; break }
        if (!/^https?:\/\//i.test(s)) { errors.push('manageUrl 必须以 http:// 或 https:// 开头'); break }
        data[key] = s
        break
      }
      default: {
        // 可空唯一字符串字段：空字符串统一转 NULL，避免唯一索引冲突
        if (
          (key === 'serialNo') &&
          (value === null || value === '' || String(value).trim() === '')
        ) {
          data[key] = null
          break
        }
        data[key] = value
      }
    }
  }

  return { data, errors }
}
