/**
 * 网络设备 DTO：字段白名单、严格校验、空字符串→NULL
 * 供 network-devices API 统一使用（非法参数 400、可空唯一字段空串转 NULL 防唯一冲突）。
 */

/** 设备类型枚举（与需求文档 §6.1 一致） */
export const NETWORK_DEVICE_TYPES = ['交换机', '路由器', 'AP', '防火墙', '其他'] as const
/** 管理类型枚举 */
export const NETWORK_MANAGE_TYPES = ['网管型', '非网管'] as const
/** 状态枚举（全局统一） */
export const ASSET_STATUS_VALUES = ['正常', '停用', '报废'] as const

/** 可更新字段白名单 */
export const NETWORK_DEVICE_FIELDS = [
  'storeId', 'deviceType', 'manageType', 'brand', 'model', 'serialNo',
  'managementIp', 'macAddress', 'portCount', 'uplinkPort', 'firmwareVersion',
  'installLocation', 'status', 'remark',
] as const

export type NetworkDeviceField = (typeof NETWORK_DEVICE_FIELDS)[number]

/** 校验结果 */
export interface NetworkDeviceFieldValidation {
  data: Record<string, unknown>
  errors: string[]
}

/** 空串 → null（可空唯一字段 + 可空文本字段，避免存储空串） */
const NULLABLE_UNIQUE_FIELDS = new Set(['serialNo', 'managementIp', 'macAddress'])
const NULLABLE_TEXT_FIELDS = new Set(['manageType', 'brand', 'model', 'uplinkPort', 'firmwareVersion', 'installLocation'])

/** 按白名单严格校验并清洗网络设备请求体（POST/PUT 共用） */
export function validateNetworkDeviceFields(body: Record<string, unknown>): NetworkDeviceFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of NETWORK_DEVICE_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'storeId': {
        const n = Number(value)
        if (!Number.isInteger(n) || n < 1) { errors.push('storeId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'deviceType': {
        const s = String(value).trim()
        if (!NETWORK_DEVICE_TYPES.includes(s as never)) {
          errors.push(`deviceType 只允许 ${NETWORK_DEVICE_TYPES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      case 'manageType': {
        const s = String(value).trim()
        if (s === '') { data[key] = null; break }
        if (!NETWORK_MANAGE_TYPES.includes(s as never)) {
          errors.push(`manageType 只允许 ${NETWORK_MANAGE_TYPES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      case 'portCount': {
        if (value === undefined) break
        // null/空串 → null（支持清空为 NULL）；0 是合法值
        if (value === null || value === '' || String(value).trim() === '') { data[key] = null; break }
        const n = Number(value)
        if (!Number.isInteger(n) || n < 0) { errors.push('portCount 必须是非负整数'); break }
        data[key] = n
        break
      }
      case 'status': {
        const s = String(value).trim()
        if (!ASSET_STATUS_VALUES.includes(s as never)) {
          errors.push(`status 只允许 ${ASSET_STATUS_VALUES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      default: {
        // 可空文本字段：trim 后空串 → null（唯一字段防唯一索引冲突，文本字段避免存空串/前后空格）
        if (NULLABLE_UNIQUE_FIELDS.has(key) || NULLABLE_TEXT_FIELDS.has(key)) {
          const s = String(value).trim()
          if (s === '') { data[key] = null; break }
          data[key] = s
          break
        }
        data[key] = value
      }
    }
  }

  return { data, errors }
}

/**
 * 网络设备 API 错误映射（纯函数，可单测）：Prisma 错误码 → 友好 HTTP 响应。
 * 返回 null 表示非已知错误（调用方应原样抛出）。
 */
export function mapDeviceApiError(error: unknown): { statusCode: number; message: string } | null {
  const code = (error as { code?: string })?.code
  if (code === 'P2002') {
    return { statusCode: 409, message: '序列号/管理IP/MAC 与已有设备重复' }
  }
  if (code === 'P2003') {
    return { statusCode: 409, message: '所选门店不存在' }
  }
  if (code === 'P2025') {
    return { statusCode: 404, message: '网络设备不存在' }
  }
  return null
}

/** 设备显示名（日志/界面用）：品牌+型号，缺省回退「未命名类型」 */
export function formatDeviceName(d: { brand?: string | null; model?: string | null; deviceType: string }): string {
  const parts = [d.brand, d.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${d.deviceType}`
}
