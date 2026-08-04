/** 小程序管理类型定义 */

export interface MiniappItem {
  id: number
  name: string           // 小程序名称
  email: string          // 绑定邮箱
  emailPassword: string  // 邮箱密码（敏感）
  remark: string         // 备注
  status: string         // 正常/停用
}
