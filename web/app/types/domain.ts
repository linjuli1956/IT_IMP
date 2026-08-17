/** 域名管理类型定义 */

export interface DomainItem {
  id: number
  domain: string         // 域名（如 example.invalid）
  mainAccount: string    // 阿里云主账号（敏感）
  mainPassword: string   // 主账号密码（仅提交时携带；列表/详情不回传明文）
  mainPasswordSet?: boolean // 是否已配置密码（列表返回的安全标记）
  certType: string       // 证书类型：DV/OV/EV
  certIssuer: string     // 颁发机构（如 Let's Encrypt、阿里云SSL）
  certRenewDate: string  // 证书更换日期（YYYY-MM-DD）
  certExpireDate: string // 证书到期日期（YYYY-MM-DD）
  remark: string         // 备注
  status: string         // 正常/停用
}
