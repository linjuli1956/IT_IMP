/** 发票/批次类型定义 */

/** OCR 提取的发票信息 */
export interface OcrResult {
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  buyerName: string
  amount: number
  amountSource: '大写金额' | '小写标记' | '价税合计' | '兜底' | '未识别'
  taxAmount: number
  totalAmount: number
  confidence: number
  rawText: string
  error?: string
}

export interface InvoiceFile {
  id: number
  name: string // 文件名
  carrier: string // 运营商
  feeMonth: string // 费用月 (如 2026-07)
  stores: string[] // 门店/机构（支持多部门）
  amount: number // 价税合计
  status: 'uploaded' | 'ocr-pending' | 'ocr-confirmed' | 'ocr-failed'
  uploadTime: string
  batchId?: number
  filePath?: string // PDF文件路径（静态原型阶段指向public目录）
  invoiceNumber?: string // 发票号码
  invoiceDate?: string // 开票日期 YYYY-MM-DD
  sellerName?: string // 销售方名称
  ocrResult?: OcrResult // OCR识别结果
}

export interface Batch {
  id: number
  batchNo?: string // 批次号（API返回，如 202606DX01）
  carrier: string
  feeMonth: string
  store: string
  invoiceCount: number
  totalAmount: number
  status: 'pending' | 'accrued' | 'printed'
  createTime: string
  invoices: InvoiceFile[]
}
