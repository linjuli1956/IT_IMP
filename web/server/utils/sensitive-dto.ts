/**
 * 基础数据访问边界 DTO（域名/小程序/支付配置）
 *
 * 列表、详情与 CUD 响应统一剥离敏感明文，仅附带"是否已配置"标记：
 * - 域名：mainPassword 不返回（标记 mainPasswordSet）
 * - 小程序：emailPassword 不返回（标记 emailPasswordSet）
 * - 支付：isSensitive=true 时 configValue 不返回（标记 sensitiveConfigured）
 *
 * 敏感明文仅可通过显式"查看已保存凭据/敏感值"接口获取
 * （沿用服务器凭据模式：/api/servers/:id/password）。
 * 不加密、不迁移数据库，仅收口响应边界。
 */

/** 域名记录（Prisma Domain 模型的运行时形态） */
export interface DomainRecord {
  id: number
  domain: string
  mainAccount: string
  mainPassword?: string | null
  certType?: string
  certIssuer?: string
  certRenewDate?: string
  certExpireDate?: string
  remark?: string
  status?: string
  [key: string]: unknown
}

/** 小程序记录 */
export interface MiniappRecord {
  id: number
  name: string
  email?: string
  emailPassword?: string | null
  remark?: string
  status?: string
  [key: string]: unknown
}

/** 支付配置记录 */
export interface PaymentConfigRecord {
  id: number
  storeId: string
  storeName: string
  payMethod: string
  payMethodName?: string
  provider: string
  configName: string
  configValue?: string | null
  posNo?: string
  status?: string
  isSensitive?: boolean
  [key: string]: unknown
}

/** 域名响应 DTO：剥离 mainPassword，附带是否已配置标记 */
export function toDomainDto<T extends DomainRecord>(domain: T): Omit<T, 'mainPassword'> & { mainPasswordSet: boolean } {
  const mainPasswordSet = Boolean(domain.mainPassword)
  const { mainPassword: _omit, ...rest } = domain
  return { ...rest, mainPasswordSet } as Omit<T, 'mainPassword'> & { mainPasswordSet: boolean }
}

/** 小程序响应 DTO：剥离 emailPassword，附带是否已配置标记 */
export function toMiniappDto<T extends MiniappRecord>(miniapp: T): Omit<T, 'emailPassword'> & { emailPasswordSet: boolean } {
  const emailPasswordSet = Boolean(miniapp.emailPassword)
  const { emailPassword: _omit, ...rest } = miniapp
  return { ...rest, emailPasswordSet } as Omit<T, 'emailPassword'> & { emailPasswordSet: boolean }
}

/** 支付配置响应 DTO：isSensitive=true 时剥离 configValue，附带是否已配置标记 */
export function toPaymentDto<T extends PaymentConfigRecord>(config: T): Omit<T, 'configValue'> & { sensitiveConfigured?: boolean } {
  if (config.isSensitive) {
    const sensitiveConfigured = Boolean(config.configValue)
    const { configValue: _omit, ...rest } = config
    return { ...rest, sensitiveConfigured } as Omit<T, 'configValue'> & { sensitiveConfigured: boolean }
  }
  return { ...config } as Omit<T, 'configValue'> & { sensitiveConfigured?: boolean }
}

/**
 * 更新载荷的敏感字段空值保护：
 * 敏感字段为空字符串/未提供时不更新（防止编辑弹窗留空意外清空已保存凭据）。
 * 三个模块共用：域名 mainPassword / 小程序 emailPassword / 支付 configValue。
 */
export function omitEmptySensitiveFields(
  data: Record<string, unknown>,
  fields: readonly string[],
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...data }
  for (const field of fields) {
    const value = result[field]
    if (value === undefined || value === null || value === '') {
      delete result[field]
    }
  }
  return result
}
