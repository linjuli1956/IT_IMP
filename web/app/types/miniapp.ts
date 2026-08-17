/** 小程序管理类型定义 */

export interface MiniappItem {
  id: number
  name: string           // 小程序名称
  email: string          // 绑定邮箱
  emailPassword: string  // 邮箱密码（仅提交时携带；列表/详情不回传明文）
  emailPasswordSet?: boolean // 是否已配置密码（列表返回的安全标记）
  remark: string         // 备注
  status: string         // 正常/停用
}
