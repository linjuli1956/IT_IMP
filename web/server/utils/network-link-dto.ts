/**
 * 网络设备连接关系 DTO：字段白名单、严格类型校验、连接关系校验纯函数。
 * 供 network-devices/links API 统一使用。
 * 设计依据：docs/网络拓扑图设计方案.md §2.3
 */

/** 连接类型枚举（与设计文档一致） */
export const NETWORK_LINK_TYPES = ['上联', '级联', '直连', '其他'] as const

/** 可更新字段白名单 */
export const NETWORK_LINK_FIELDS = [
  'sourceDeviceId', 'targetDeviceId', 'sourcePort', 'targetPort',
  'linkType', 'remark',
] as const

export type NetworkLinkField = (typeof NETWORK_LINK_FIELDS)[number]

/** 校验结果 */
export interface NetworkLinkFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/** 判断值是否为普通对象（排除 null、数组、Date 等非纯对象） */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  )
}

/** 判断值是否为合法正安全整数（排除布尔、字符串、小数、非安全整数） */
function isPositiveSafeInteger(value: unknown): value is number {
  if (typeof value === 'boolean') return false
  if (typeof value === 'string') return false
  if (typeof value !== 'number') return false
  if (!Number.isSafeInteger(value)) return false
  return value >= 1
}

/** 判断值是否为合法文本字段（排除对象、数组、布尔，只接受 string 或 number） */
function isTextValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

/**
 * 校验请求体是否为普通对象（入口守卫）。
 * null、数组、基本类型直接拒绝。
 */
export function validateLinkBody(body: unknown): { ok: true; body: Record<string, unknown> } | { ok: false; error: string } {
  if (!isPlainObject(body)) {
    return { ok: false, error: '请求体必须是 JSON 对象' }
  }
  return { ok: true, body }
}

/**
 * 按白名单严格校验并清洗连接关系请求体（POST 共用）。
 * 严格类型检查：布尔/对象/数组/空串/小数/非安全整数均被拒绝。
 */
export function validateNetworkLinkFields(body: Record<string, unknown>): NetworkLinkFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of NETWORK_LINK_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'sourceDeviceId': {
        if (!isPositiveSafeInteger(value)) {
          errors.push('sourceDeviceId 必须是不小于 1 的安全整数（禁止布尔、对象、数组、空串、小数）')
          break
        }
        data[key] = value
        break
      }
      case 'targetDeviceId': {
        if (!isPositiveSafeInteger(value)) {
          errors.push('targetDeviceId 必须是不小于 1 的安全整数（禁止布尔、对象、数组、空串、小数）')
          break
        }
        data[key] = value
        break
      }
      case 'linkType': {
        if (!isTextValue(value)) {
          errors.push('linkType 必须是字符串')
          break
        }
        const s = String(value).trim()
        if (!NETWORK_LINK_TYPES.includes(s as never)) {
          errors.push(`linkType 只允许 ${NETWORK_LINK_TYPES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      default: {
        // 文本字段：禁止对象、数组、布尔被 String() 静默转字符串
        if (!isTextValue(value)) {
          errors.push(`${key} 必须是字符串或数字（禁止对象、数组、布尔）`)
          break
        }
        data[key] = String(value).trim()
      }
    }
  }

  return { data, errors }
}

/**
 * 纯函数校验：禁止自连接
 * @returns 错误消息，通过则返回 null
 */
export function checkSelfConnection(sourceDeviceId: number, targetDeviceId: number): string | null {
  if (sourceDeviceId === targetDeviceId) {
    return '禁止自连接：sourceDeviceId 和 targetDeviceId 不能相同'
  }
  return null
}

/**
 * 纯函数校验：禁止反方向重复连接
 * 检查是否已存在反方向的连接（A→B 存在时，禁止新建 B→A）
 * @param existingLinks 已有连接列表
 * @param newSource 新建连接的 sourceDeviceId
 * @param newTarget 新建连接的 targetDeviceId
 * @returns 错误消息，通过则返回 null
 */
export function checkReverseDuplicate(
  existingLinks: { sourceDeviceId: number; targetDeviceId: number }[],
  newSource: number,
  newTarget: number,
): string | null {
  for (const link of existingLinks) {
    if (link.sourceDeviceId === newTarget && link.targetDeviceId === newSource) {
      return `禁止反方向重复连接：已存在 ${newTarget}→${newSource} 的连接`
    }
  }
  return null
}

/**
 * 纯函数校验：禁止同方向重复连接（含端口）
 * Prisma 唯一约束也会拦截，但提前校验给出更友好的错误
 * @param existingLinks 已有连接列表（含端口）
 * @param newSource 新建连接的 sourceDeviceId
 * @param newTarget 新建连接的 targetDeviceId
 * @param newSourcePort 新建连接的 sourcePort
 * @param newTargetPort 新建连接的 targetPort
 * @returns 错误消息，通过则返回 null
 */
export function checkSameDirectionDuplicate(
  existingLinks: { sourceDeviceId: number; targetDeviceId: number; sourcePort: string; targetPort: string }[],
  newSource: number,
  newTarget: number,
  newSourcePort: string,
  newTargetPort: string,
): string | null {
  for (const link of existingLinks) {
    if (
      link.sourceDeviceId === newSource &&
      link.targetDeviceId === newTarget &&
      link.sourcePort === newSourcePort &&
      link.targetPort === newTargetPort
    ) {
      return '连接关系已存在（同方向重复）'
    }
  }
  return null
}

/**
 * 连接关系 API 错误映射（纯函数，可单测）：Prisma 错误码 → 友好 HTTP 响应。
 * 返回 null 表示非已知错误（调用方应原样抛出）。
 */
export function mapLinkApiError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') {
    return { statusCode: 409, message: '连接关系已存在（同方向重复）' }
  }
  if (code === 'P2003') {
    return { statusCode: 404, message: '源设备或目标设备不存在' }
  }
  if (code === 'P2025') {
    return { statusCode: 404, message: '连接关系不存在' }
  }
  return null
}

/**
 * 判断错误是否为可重试的并发冲突（死锁/序列化失败/锁超时）。
 * 纯函数，可单测。
 */
export function isRetryableConcurrencyError(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  const message = (error as { message?: string })?.message ?? ''
  // Prisma 事务超时
  if (code === 'P2028') return true
  // MySQL 死锁 (ER_LOCK_DEADLOCK = 1213)
  if (code === 'P2034' || message.includes('Deadlock') || message.includes('1213')) return true
  // MySQL 锁等待超时 (ER_LOCK_WAIT_TIMEOUT = 1205)
  if (message.includes('Lock wait timeout') || message.includes('1205')) return true
  // MySQL 序列化失败
  if (message.includes('Serialization failure') || message.includes('1213')) return true
  return false
}
