/**
 * 网络设备连接关系 DTO：字段白名单、严格校验、连接关系校验纯函数。
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

/** 按白名单严格校验并清洗连接关系请求体（POST 共用） */
export function validateNetworkLinkFields(body: Record<string, unknown>): NetworkLinkFieldValidation {
  const data: Record<string, unknown> = {}
  const errors: string[] = []

  for (const key of NETWORK_LINK_FIELDS) {
    if (!(key in body)) continue
    const value = body[key]

    switch (key) {
      case 'sourceDeviceId': {
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < 1) { errors.push('sourceDeviceId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'targetDeviceId': {
        const n = Number(value)
        if (!Number.isSafeInteger(n) || n < 1) { errors.push('targetDeviceId 必须是不小于 1 的整数'); break }
        data[key] = n
        break
      }
      case 'linkType': {
        const s = String(value).trim()
        if (!NETWORK_LINK_TYPES.includes(s as never)) {
          errors.push(`linkType 只允许 ${NETWORK_LINK_TYPES.join('/')}`)
          break
        }
        data[key] = s
        break
      }
      default: {
        // 文本字段：trim 后空串保持空串（端口允许为空，非唯一字段）
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
