/** 计提模板类型定义 */

export interface TemplateItem {
  dept: string[]    // 承担部门（支持多选）
  name: string      // 名称/号码
  amount: number    // 预设费用（0表示需计算）
  remark: string    // 备注
}

export interface AccrualTemplate {
  id: number
  carrier: string           // 运营商
  store: string             // 门店/机构
  itemCount: number         // 明细行数
  updateTime: string        // 更新时间
  reimbursementFormat: string  // 报销说明预设格式
  reimbursementCustom: string  // 自定义报销说明格式
  items: TemplateItem[]     // 模板明细行
}
