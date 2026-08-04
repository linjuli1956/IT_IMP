/** 预算管理类型定义 */

export interface BudgetDetail {
  id: number
  fiscalYear: number      // 财年（2026表示26财年=2026.4~2027.3）
  storeName: string       // 门店（全称）
  carrier: string         // 运营商：电信/移动/联通/其他
  feeType: string         // 费用类型：宽带/固话手机/物联网/监控/云服务
  monthlyFee: number      // 月费（元）
  annualFee: number       // 年费（元）
  feeRange: string        // 费用含括范围
  broadbandType: string   // 宽带类型
  paymentMethod: string   // 缴费方式：年缴费/月缴费
  remark: string          // 备注
}

export interface BudgetExecution {
  id: number
  fiscalYear: number      // 财年（2026表示26财年=2026.4~2027.3）
  storeName: string
  carrier: string
  month: string           // 实际月份 YYYY-MM
  budgetAmount: number
  actualAmount: number
}
