/** 明细表类型定义 */

export interface DetailRow {
  number: string       // 业务号码
  monthlyFee: number   // 月基本费
  voiceFee: number     // 语音通信费
  smsFee: number       // 短信彩信费
  infoFee: number      // 综合信息服务费
  discountFee: number  // 优惠费用
  totalFee: number     // 应收合计
}

export interface DetailSheet {
  sheetName: string    // sheet 名称（通常对应门店名）
  store: string        // 匹配的门店
  rows: DetailRow[]
  totalAmount: number  // 该 sheet 合计金额
  totalNumbers: number // 该 sheet 号码数
}

export interface DetailTable {
  id: number
  carrier: string      // 运营商
  feeMonth: string     // 费用月
  fileName: string     // 原始文件名
  uploadTime: string
  sheetCount: number   // sheet 数量
  totalNumbers: number // 总号码数
  totalAmount: number  // 总金额
  sheets: DetailSheet[]
}
