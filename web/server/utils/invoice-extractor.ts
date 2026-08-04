/**
 * 发票字段提取模块
 * 从 PDF 文本中提取发票号、开票日期、销售方/购买方、金额、税额等
 * 移植用户已有的 4 级金额策略
 */

/** 提取的发票信息 */
export interface ExtractedInvoice {
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  buyerName: string
  amount: number
  amountSource: '大写金额' | '小写标记' | '价税合计' | '兜底' | '未识别'
  taxAmount: number
  totalAmount: number
  confidence: number
}

/** 大写金额数字映射 */
const CHINESE_NUM: Record<string, string> = {
  '零': '0', '壹': '1', '贰': '2', '叁': '3', '肆': '4',
  '伍': '5', '陆': '6', '柒': '7', '捌': '8', '玖': '9',
  '拾': '', '佰': '', '仟': '', '万': '', '亿': '',
}

/** 大写金额单位 */
const AMOUNT_UNITS: Record<string, number> = {
  '拾': 10, '佰': 100, '仟': 1000, '万': 10000, '亿': 100000000,
}

/**
 * 解析中文大写金额为数字
 * 如 "壹仟贰佰叁拾肆元伍角陆分" → 1234.56
 */
function parseChineseAmount(text: string): number | null {
  // 检查是否包含大写金额特征字符
  if (!/[壹贰叁肆伍陆柒捌玖拾佰仟万亿元角分圆整]/.test(text)) return null

  // 尝试提取 ¥ 后的数字（同行优先）
  const yenMatch = text.match(/¥\s*([\d,]+\.?\d*)/)
  if (yenMatch) {
    const num = parseFloat(yenMatch[1]!.replace(/,/g, ''))
    if (!isNaN(num) && num > 0) return num
  }

  // 尝试从大写金额解析
  let result = 0
  let current = 0
  let hasDigit = false

  for (const char of text) {
    if (CHINESE_NUM[char] !== undefined) {
      const digit = parseInt(CHINESE_NUM[char])
      if (!isNaN(digit) && digit > 0) {
        current = current === 0 ? digit : current * 10 + digit
        hasDigit = true
      }
    } else if (AMOUNT_UNITS[char] !== undefined) {
      const unit = AMOUNT_UNITS[char]
      if (current === 0) current = 1
      result += current * unit
      current = 0
      hasDigit = true
    } else if (char === '元' || char === '圆') {
      result += current
      current = 0
    } else if (char === '角') {
      result += current * 0.1
      current = 0
    } else if (char === '分') {
      result += current * 0.01
      current = 0
    } else if (char === '整') {
      // 忽略
    }
  }

  if (hasDigit) {
    result += current
    return Math.round(result * 100) / 100
  }
  return null
}

/**
 * 从文本行中提取 ¥ 格式金额
 */
function extractYenAmount(line: string): number | null {
  const match = line.match(/¥\s*([\d,]+\.?\d*)/)
  if (match) {
    const num = parseFloat(match[1]!.replace(/,/g, ''))
    if (!isNaN(num) && num > 0) return num
  }
  return null
}

/**
 * 从文本行中提取纯数字金额
 */
function extractPlainAmount(line: string): number | null {
  // 匹配各种金额格式：1234.56, 1,234.56
  const match = line.match(/([\d,]+\.?\d*)/)
  if (match) {
    const num = parseFloat(match[1]!.replace(/,/g, ''))
    if (!isNaN(num) && num > 0) return num
  }
  return null
}

/**
 * 4 级金额提取策略
 * 1. 大写金额行（含壹贰叁…圆角分）→ 同行 ¥ 金额
 * 2. "小写"标记同行 → ¥ 金额（移动发票格式）
 * 3. "价税合计"后的数字
 * 4. 兜底：全文找 10~50000 的数字
 */
function extractAmount(text: string): { amount: number; source: '大写金额' | '小写标记' | '价税合计' | '兜底' | '未识别' } {
  const lines = text.split('\n')

  // 策略1：大写金额行
  for (const line of lines) {
    if (/[壹贰叁肆伍陆柒捌玖拾佰仟万亿元角分圆整]/.test(line)) {
      // 先找同行 ¥ 金额
      const yen = extractYenAmount(line)
      if (yen && yen >= 0.01) return { amount: yen, source: '大写金额' }
      // 尝试解析大写金额
      const chinese = parseChineseAmount(line)
      if (chinese && chinese >= 0.01) return { amount: chinese, source: '大写金额' }
    }
  }

  // 策略2："小写"标记同行
  for (const line of lines) {
    if (line.includes('小写') || line.includes('（小写）') || line.includes('(小写)')) {
      const yen = extractYenAmount(line)
      if (yen && yen >= 0.01) return { amount: yen, source: '小写标记' }
      const plain = extractPlainAmount(line)
      if (plain && plain >= 0.01) return { amount: plain, source: '小写标记' }
    }
  }

  // 策略3："价税合计"后的数字
  for (const line of lines) {
    if (line.includes('价税合计') || line.includes('价税合计（大写）') || line.includes('价税合计(大写)')) {
      // 先找同行 ¥ 金额
      const yen = extractYenAmount(line)
      if (yen && yen >= 0.01) return { amount: yen, source: '价税合计' }
      // 找下一行的数字
      const idx = lines.indexOf(line)
      if (idx >= 0 && idx + 1 < lines.length) {
        const nextLine = lines[idx + 1]!
        const nextYen = extractYenAmount(nextLine)
        if (nextYen && nextYen >= 0.01) return { amount: nextYen, source: '价税合计' }
        const nextPlain = extractPlainAmount(nextLine)
        if (nextPlain && nextPlain >= 0.01) return { amount: nextPlain, source: '价税合计' }
      }
    }
  }

  // 策略3.5："合计"行
  for (const line of lines) {
    if (line.includes('合计') && !line.includes('价税')) {
      const yen = extractYenAmount(line)
      if (yen && yen >= 0.01) return { amount: yen, source: '价税合计' }
    }
  }

  // 策略4：兜底 — 全文找 10~50000 的数字
  for (const line of lines) {
    const yen = extractYenAmount(line)
    if (yen && yen >= 10 && yen <= 50000) return { amount: yen, source: '兜底' }
  }
  for (const line of lines) {
    const plain = extractPlainAmount(line)
    if (plain && plain >= 10 && plain <= 50000) return { amount: plain, source: '兜底' }
  }

  return { amount: 0, source: '未识别' }
}

/**
 * 提取发票号码 — 匹配 20 位以上纯数字行
 */
function extractInvoiceNumber(text: string): string {
  const lines = text.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // 匹配纯数字行，长度 ≥ 20
    if (/^\d{20,}$/.test(trimmed)) return trimmed
  }
  // 兜底：匹配含"发票号码"标签后的数字
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('发票号码') || line.includes('发票号')) {
      const match = line.match(/(\d{8,})/)
      if (match) return match[1]!
      // 检查下一行
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]!
        const nextMatch = nextLine.match(/(\d{8,})/)
        if (nextMatch) return nextMatch[1]!
      }
    }
  }
  return ''
}

/**
 * 提取开票日期 — 正则 \d{4}年\d{1,2}月\d{1,2}日，转为 YYYY-MM-DD
 */
function extractInvoiceDate(text: string): string {
  // 先尝试匹配"开票日期"标签后的日期
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('开票日期') || line.includes('开票时间')) {
      // 同行匹配
      const match = line.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
      if (match) {
        return formatDate(match[1]!, match[2]!, match[3]!)
      }
      // 同行匹配 YYYY-MM-DD
      const dashMatch = line.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
      if (dashMatch) {
        return formatDate(dashMatch[1]!, dashMatch[2]!, dashMatch[3]!)
      }
      // 检查下一行
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]!
        const nextMatch = nextLine.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
        if (nextMatch) return formatDate(nextMatch[1]!, nextMatch[2]!, nextMatch[3]!)
        const nextDash = nextLine.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
        if (nextDash) return formatDate(nextDash[1]!, nextDash[2]!, nextDash[3]!)
      }
    }
  }

  // 全文匹配第一个日期
  const match = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (match) return formatDate(match[1]!, match[2]!, match[3]!)

  const dashMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (dashMatch) return formatDate(dashMatch[1]!, dashMatch[2]!, dashMatch[3]!)

  return ''
}

/** 格式化为 YYYY-MM-DD */
function formatDate(y: string, m: string, d: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

/**
 * 提取销售方/购买方名称
 * 发票为两栏布局：购买方在左、销售方在右
 * 去空格后"名称："标签可能出现在同一行，用 split 拆分所有出现位置
 * parts[1] = 购买方名称, parts[2] = 销售方名称
 */
function extractPartyNames(text: string): { sellerName: string; buyerName: string } {
  let sellerName = ''
  let buyerName = ''

  // 用"名称："拆分全文，第一个之后是购买方，第二个之后是销售方
  const parts = text.split(/名称[:：]/)

  if (parts.length >= 2) {
    buyerName = cleanName(parts[1]!)
  }
  if (parts.length >= 3) {
    sellerName = cleanName(parts[2]!)
  }

  return { sellerName, buyerName }
}

/** 清理名称字符串 — 去掉换行、税号、地址等附加信息 */
function cleanName(raw: string): string {
  let name = raw.trim()
  // 取第一个非空行（两栏布局可能导致名称后跟其他列的内容）
  const firstLine = name.split('\n').find(l => l.trim())
  name = (firstLine ?? name).trim()
  // 截取到第一个分隔符（税号、地址等）
  name = name.split(/[,，。；;：:\t]/)[0] ?? name
  // 去掉常见前缀
  name = name.replace(/^(名称[:：]\s*)/, '')
  return name.trim()
}

/**
 * 提取税额 — 发票"合计"行有两个 ¥ 金额，最后一个是税额
 * 格式如：¥456.19¥40.63
 */
function extractTaxAmount(text: string): number {
  const lines = text.split('\n')

  // 策略1：“合计”行（排除“价税合计”）的最后一个 ¥ 金额
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.includes('合计') && !line.includes('价税合计')) {
      // 当前行找 ¥ 金额
      let allYen = [...line.matchAll(/¥\s*([\d,]+\.?\d*)/g)]
      if (allYen.length >= 2) {
        const num = parseFloat(allYen[allYen.length - 1]![1]!.replace(/,/g, ''))
        if (!isNaN(num) && num > 0) return num
      }
      // 检查下一行（合计行常与金额行分开）
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1]!
        allYen = [...nextLine.matchAll(/¥\s*([\d,]+\.?\d*)/g)]
        if (allYen.length >= 2) {
          const num = parseFloat(allYen[allYen.length - 1]![1]!.replace(/,/g, ''))
          if (!isNaN(num) && num > 0) return num
        }
      }
    }
  }

  // 策略2：“税额”标签后的数字
  for (const line of lines) {
    if (line.includes('税额') && !line.includes('税率')) {
      const yen = extractYenAmount(line)
      if (yen && yen > 0) return yen
      const match = line.match(/税额[:：\s]*¥?\s*([\d,]+\.?\d*)/)
      if (match) {
        const num = parseFloat(match[1]!.replace(/,/g, ''))
        if (!isNaN(num) && num > 0) return num
      }
    }
  }
  return 0
}

/**
 * 计算可信度 — 根据提取到的字段数量
 */
function calculateConfidence(fields: { invoiceNumber: string; invoiceDate: string; sellerName: string; buyerName: string; amount: number }): number {
  let count = 0
  const total = 5
  if (fields.invoiceNumber) count++
  if (fields.invoiceDate) count++
  if (fields.sellerName) count++
  if (fields.buyerName) count++
  if (fields.amount > 0) count++
  return Math.round((count / total) * 100) / 100
}

/**
 * 从 PDF 原始文本中提取发票字段
 * PDF 文本提取后字符间可能有多余空格（如 "¥ 4 9 6 . 8 2"），
 * 中文发票不含空格，安全去除所有空格后再做正则匹配
 */
export function extractInvoiceFields(rawText: string): ExtractedInvoice {
  // 去除所有空格（中文发票文本不含空格，空格是 PDF 文本提取的副作用）
  const text = rawText.replace(/ /g, '')

  const { amount, source } = extractAmount(text)
  const invoiceNumber = extractInvoiceNumber(text)
  const invoiceDate = extractInvoiceDate(text)
  const { sellerName, buyerName } = extractPartyNames(text)
  const taxAmount = extractTaxAmount(text)

  // totalAmount 通常等于 amount（价税合计）
  const totalAmount = amount

  const confidence = calculateConfidence({
    invoiceNumber,
    invoiceDate,
    sellerName,
    buyerName,
    amount,
  })

  return {
    invoiceNumber,
    invoiceDate,
    sellerName,
    buyerName,
    amount,
    amountSource: source,
    taxAmount,
    totalAmount,
    confidence,
  }
}
