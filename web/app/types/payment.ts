/** 支付管理类型定义 */

export interface PaymentConfigItem {
  id: number
  storeId: string          // 机构代码
  storeName: string        // 门店名称
  payMethod: string        // wx/zfb/yl/yzf
  payMethodName: string    // 微信/支付宝/银联/翼支付
  provider: string         // 服务商: 中国邮政/昂捷/昂捷离线付
  configName: string       // 商户号/密钥/APPID等
  configValue?: string     // 配置值（isSensitive=true 时列表/详情不回传，是否已配置看 sensitiveConfigured；编辑提交时携带）
  sensitiveConfigured?: boolean // 敏感值是否已配置（列表返回的安全标记）
  posNo: string            // POS号
  status: string           // 正常/停用
  isSensitive: boolean     // 密钥/秘钥/退款密码=true
}
