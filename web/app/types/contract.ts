/** 合同管理类型定义 */

export interface Contract {
  id: number
  title: string          // 合同标题
  supplierName: string   // 客户名称
  type: string           // 合同类型：宽带/设备采购/项目/采购/维保
  amount: number         // 合同金额（元）
  signDate: string       // 签订日期 YYYY-MM-DD
  expireDate: string     // 到期日期 YYYY-MM-DD
  fileName: string       // 附件文件名
  filePath: string       // 附件存储路径
  remark: string         // 备注
}
