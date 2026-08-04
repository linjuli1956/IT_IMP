/** 费用分摊方案类型定义 — 通用费用分摊规则引擎 */

/** 分摊明细 — 一个费用项如何拆分到各门店 */
export interface FeeAllocation {
  store: string            // 门店
  dept: string[]           // 承担部门
  value: number            // fixed=金额 / ratio=百分比 / quantity=数量
  remark: string           // 备注
}

/** 费用项 — 一项独立费用 */
export interface FeeItem {
  feeType: string          // 费用类型：宽带 / 专线 / 固话 / 固定IP / 其他
  name: string             // 费用名称，如"商务宽带套餐"、"联通专线"
  amountSource: 'fixed' | 'invoice' | 'manual'  // 金额来源
  fixedAmount: number      // 固定金额（amountSource=fixed 时使用）
  allocationMode: 'fixed' | 'ratio' | 'quantity' | 'manual'  // 分摊方式
  allocations: FeeAllocation[]  // 分摊明细
  remark: string           // 备注
}

/** 费用分摊方案 — 一组费用项的集合 */
export interface FeeAllocationScheme {
  id: number
  name: string             // 方案名称，如"联通宽带套餐分摊"
  carrier: string          // 运营商（空=通用）
  items: FeeItem[]         // 费用项列表
  reimbursementFormat: string   // 报销说明格式
  reimbursementCustom: string   // 自定义报销说明
  status: number           // 1=启用 0=禁用
  updateTime: string       // 更新时间
}

/** 费用类型预设列表（前端 el-select allow-create 使用） */
export const FEE_TYPE_PRESETS = ['宽带', '专线', '固话', '固定IP', '其他']

/** 分摊方式选项 */
export const ALLOCATION_MODE_OPTIONS = [
  { label: '固定金额', value: 'fixed' as const },
  { label: '比例', value: 'ratio' as const },
  { label: '按数量', value: 'quantity' as const },
  { label: '手动', value: 'manual' as const },
]

/** 金额来源选项 */
export const AMOUNT_SOURCE_OPTIONS = [
  { label: '固定金额', value: 'fixed' as const },
  { label: '发票总额', value: 'invoice' as const },
  { label: '手动输入', value: 'manual' as const },
]
