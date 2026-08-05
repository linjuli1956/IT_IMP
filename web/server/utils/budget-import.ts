/**
 * 预算 Excel 导入：解析与校验（纯函数，不依赖 H3 / Prisma，便于单元测试）
 *
 * 模板列与前端下载模板保持一致：财年、门店、运营商、费用类型、月费(元)、年费(元)、费用范围、宽带类型、缴费方式、备注。
 * 校验规则：
 * - 财年为整数（2000~2100）；
 * - 门店 / 运营商 / 费用类型必填；
 * - 月费 / 年费为数字（空按 0 处理）；
 * - 费用范围格式 YYYY-MM~YYYY-MM（可空，空 = 全年有效）。
 * 任一数据行校验失败时整批拒绝（由调用方决定），错误携带 Excel 实际行号便于用户定位。
 */
import * as XLSX from 'xlsx'

/** 解析后的预算明细行（字段与 Prisma BudgetDetail 写入字段一致） */
export interface BudgetImportRow {
  fiscalYear: number
  storeName: string
  carrier: string
  feeType: string
  monthlyFee: number
  annualFee: number
  feeRange: string
  broadbandType: string
  paymentMethod: string
  remark: string
}

/** 单行校验错误（row 为 Excel 行号，1 起，含表头行） */
export interface BudgetImportError {
  row: number
  message: string
}

/** 解析结果：rows 为全部通过校验的行；errors 非空时调用方应整批拒绝 */
export interface BudgetParseResult {
  rows: BudgetImportRow[]
  errors: BudgetImportError[]
}

/** 表头别名 → 字段 key（优先精确匹配，其次别名，容忍 "月费(元)" 与 "月费" 等写法） */
const HEADER_ALIASES: Record<string, string[]> = {
  fiscalYear: ['财年'],
  storeName: ['门店', '门店名称'],
  carrier: ['运营商'],
  feeType: ['费用类型'],
  monthlyFee: ['月费(元)', '月费'],
  annualFee: ['年费(元)', '年费'],
  feeRange: ['费用范围', '费用含括范围'],
  broadbandType: ['宽带类型'],
  paymentMethod: ['缴费方式'],
  remark: ['备注'],
}

/** 数据行必需列（表头缺失时直接整批拒绝） */
const REQUIRED_COLUMNS: Array<keyof BudgetImportRow> = ['fiscalYear', 'storeName', 'carrier', 'feeType']

/** 费用范围格式：YYYY-MM~YYYY-MM */
const FEE_RANGE_PATTERN = /^\d{4}-\d{2}~\d{4}-\d{2}$/

/** 单元格转字符串并去除首尾空白 */
function cellText(cell: unknown): string {
  if (cell === undefined || cell === null) return ''
  return String(cell).trim()
}

/** 单元格转数字：空 → 0；非数字 → NaN（由调用方判定错误） */
function cellNumber(cell: unknown): number {
  if (cell === undefined || cell === null) return 0
  const text = String(cell).trim()
  if (text === '') return 0
  return Number(text)
}

/**
 * 解析并校验预算导入 XLSX 内容。
 * @param buffer XLSX 文件内容（.xlsx / .xls 均可，由 xlsx 库自动识别）
 * @returns 通过校验的行与错误明细；errors 非空时调用方应整批拒绝导入
 */
export function parseBudgetRows(buffer: Buffer): BudgetParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    return { rows: [], errors: [{ row: 0, message: '文件中没有可读取的 Sheet' }] }
  }

  // header: 1 → 返回数组的数组（rows[i] 对应 Excel 第 i+1 行）
  const rows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: true })

  // 查找表头行：优先匹配包含「门店」与「运营商」的行，其次假设第一行为表头
  let headerRowIdx = -1
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const cells = (rows[i] ?? []).map(cellText)
    if (cells.includes('门店') && (cells.includes('运营商') || cells.includes('费用类型'))) {
      headerRowIdx = i
      break
    }
  }
  if (headerRowIdx === -1) {
    if (rows.length === 0) {
      return { rows: [], errors: [{ row: 0, message: 'Excel 文件为空' }] }
    }
    headerRowIdx = 0
  }

  // 列名 → 列索引映射
  const colIndex: Partial<Record<keyof BudgetImportRow, number>> = {}
  const headerCells = (rows[headerRowIdx] ?? []).map(cellText)
  for (let j = 0; j < headerCells.length; j++) {
    const header = headerCells[j]
    if (!header) continue
    for (const key of Object.keys(HEADER_ALIASES) as Array<keyof BudgetImportRow>) {
      if (HEADER_ALIASES[key].includes(header)) {
        colIndex[key] = j
        break
      }
    }
  }

  // 必需列表头缺失 → 整批拒绝
  for (const key of REQUIRED_COLUMNS) {
    if (colIndex[key] === undefined) {
      return {
        rows: [],
        errors: [{ row: headerRowIdx + 1, message: `缺少必需列「${HEADER_ALIASES[key][0]}」` }],
      }
    }
  }

  const results: BudgetImportRow[] = []
  const errors: BudgetImportError[] = []

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const excelRow = i + 1
    const row = rows[i] ?? []
    const idx = (key: keyof BudgetImportRow): unknown => {
      const j = colIndex[key]
      return j === undefined ? undefined : row[j]
    }

    // 全空行跳过（不报错）
    if (row.every(cell => cellText(cell) === '')) continue

    const fiscalYearText = cellText(idx('fiscalYear'))
    const fiscalYear = Number(fiscalYearText)
    const monthlyFee = cellNumber(idx('monthlyFee'))
    const annualFee = cellNumber(idx('annualFee'))
    const feeRange = cellText(idx('feeRange'))

    // 逐字段校验，首个错误即记录并跳过该行
    if (fiscalYearText === '' || !Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
      errors.push({ row: excelRow, message: '财年需为 2000~2100 的整数（如 2026）' })
      continue
    }
    if (cellText(idx('storeName')) === '') {
      errors.push({ row: excelRow, message: '门店不能为空' })
      continue
    }
    if (cellText(idx('carrier')) === '') {
      errors.push({ row: excelRow, message: '运营商不能为空' })
      continue
    }
    if (cellText(idx('feeType')) === '') {
      errors.push({ row: excelRow, message: '费用类型不能为空' })
      continue
    }
    if (Number.isNaN(monthlyFee)) {
      errors.push({ row: excelRow, message: '月费需为数字' })
      continue
    }
    if (Number.isNaN(annualFee)) {
      errors.push({ row: excelRow, message: '年费需为数字' })
      continue
    }
    if (feeRange !== '' && !FEE_RANGE_PATTERN.test(feeRange)) {
      errors.push({ row: excelRow, message: '费用范围格式应为 YYYY-MM~YYYY-MM（如 2026-04~2027-03）' })
      continue
    }
    if (feeRange !== '' && feeRange.split('~')[1] < feeRange.split('~')[0]) {
      errors.push({ row: excelRow, message: '费用范围结束日期不能早于开始日期' })
      continue
    }

    results.push({
      fiscalYear,
      storeName: cellText(idx('storeName')),
      carrier: cellText(idx('carrier')),
      feeType: cellText(idx('feeType')),
      monthlyFee,
      annualFee,
      feeRange,
      broadbandType: cellText(idx('broadbandType')),
      paymentMethod: cellText(idx('paymentMethod')),
      remark: cellText(idx('remark')),
    })
  }

  return { rows: results, errors }
}
