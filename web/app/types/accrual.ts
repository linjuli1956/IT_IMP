/** 计提表类型定义 */

import type { DetailTable } from './detail'

export interface AccrualRow {
  seq: number           // 序号
  dept: string[]        // 承担部门
  name: string          // 名称/号码
  amount: number        // 费用金额
  remark: string        // 备注
  source: 'detail' | 'invoice' | 'calculated' | 'preset' | 'allocation' | 'manual'  // 费用来源
  feeType: string       // 费用类型（宽带/专线/固话/固定IP/其他，allocation模式使用）
}

export interface AccrualGroup {
  store: string              // 门店/机构名
  templateId: number         // 关联的模板ID（allocation模式=0）
  schemeId: number           // 关联的费用分摊方案ID（detail/invoice模式=0）
  carrier: string            // 运营商
  rows: AccrualRow[]         // 计提表行
  subtotal: number           // 小计金额
  invoiceAmount: number      // 该门店对应的发票金额（用于校验）
  reimbursementFormat: string   // 报销说明格式
  reimbursementCustom: string   // 自定义报销说明
  reimbursementText: string     // 生成的报销说明文本
}

export interface Accrual {
  id: number
  batchId: number         // 关联批次ID
  batchNo: string         // 批次号
  carrier: string         // 运营商
  feeMonth: string        // 费用月
  method: 'detail' | 'invoice' | 'allocation'  // 计提方式
  groups: AccrualGroup[]  // 按门店分组
  totalAmount: number     // 合计金额
  status: 'generated' | 'printed'  // 状态
  createTime: string      // 创建时间
  creator: string         // 制表人
}

// 重新导出 DetailTable 供计提模块使用
export type { DetailTable }
