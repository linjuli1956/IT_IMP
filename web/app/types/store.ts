/** 门店/部门/机构类型定义 */

export interface StoreItem {
  id: number
  name: string
  code: string         // 机构代码（如 10001），可为空
  sort: number
  status: number // 1=启用, 0=禁用
}
