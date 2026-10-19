/**
 * 发票 → 计提明细行 的映射与金额分摊（前后端共用）
 *
 * 业务规则：
 * - 生成计提时，用户可为每张发票选择对应的计提模板明细行（1:1 或 1:N）；
 * - 默认发票数 = 明细行数时按顺序 1:1，否则留空由用户手动选择；
 * - 1:N 时按发票金额平均分摊（2 位小数，余数进末行，合计精确等于发票金额）；
 * - 行备注追加发票号/开票日期，便于财务核对到具体发票。
 */

export interface InvoiceLike {
  id: number
  amount: number
  invoiceNumber?: string
  invoiceDate?: string
}

/**
 * 平均分摊发票金额：保留 2 位小数，余数进末行，保证合计精确等于发票金额。
 * 非法输入或数量非正时返回空数组。
 */
export function splitInvoiceAmount(amount: number, count: number): number[] {
  if (!Number.isFinite(amount) || count <= 0 || !Number.isInteger(count)) return []
  const cents = Math.round(amount * 100)
  const base = Math.floor(cents / count)
  const remainder = cents - base * count
  const parts = Array.from({ length: count }, () => base / 100)
  parts[count - 1] = (base + remainder) / 100
  return parts
}

/**
 * 默认映射：发票数 = 明细行数时按顺序 1:1；否则返回空映射（要求手动选择）。
 * 返回 Map<发票ID, 明细行索引数组>。
 */
export function buildDefaultInvoiceMapping(invoices: InvoiceLike[], rowCount: number): Map<number, number[]> {
  const map = new Map<number, number[]>()
  if (invoices.length === 0 || rowCount <= 0) return map
  if (invoices.length !== rowCount) return map
  invoices.forEach((invoice, index) => {
    map.set(invoice.id, [index])
  })
  return map
}

/**
 * 把「发票 → 行」映射展开为「行索引 → 发票列表」，供生成时构造行金额/备注。
 */
export function invertInvoiceMapping(mapping: Map<number, number[]>, invoices: InvoiceLike[]): Map<number, InvoiceLike[]> {
  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]))
  const result = new Map<number, InvoiceLike[]>()
  for (const [invoiceId, rowIndexes] of mapping) {
    const invoice = byId.get(invoiceId)
    if (!invoice) continue
    for (const rowIndex of rowIndexes) {
      const list = result.get(rowIndex) || []
      list.push(invoice)
      result.set(rowIndex, list)
    }
  }
  return result
}

// ============================================
// 服务端：解析并校验「发票 → 行」分配
// ============================================

/** 单条行分配：行索引 + 金额 + 发票ID */
export interface InvoiceAllocationEntry {
  rowIndex: number
  amount: number
  invoiceIds?: number[]
}

/** 解析后的行分配 */
export interface RowAllocation {
  amount: number
  invoices: InvoiceLike[]
}

/**
 * 解析某门店的发票分配：
 * - 未传分配 → 返回空 Map（沿用原有生成规则）；
 * - 校验行索引范围、金额有限非负、发票ID存在；非法返回 error（调用方据此 400）；
 * - 同一行索引出现多次时金额相加、发票合并。
 */
export function resolveStoreInvoiceAllocations(
  allocations: Record<string, InvoiceAllocationEntry[]> | undefined | null,
  store: string,
  rowCount: number,
  invoices: InvoiceLike[],
): { rows: Map<number, RowAllocation>; error?: string } {
  const rows = new Map<number, RowAllocation>()
  if (!allocations || typeof allocations !== 'object') return { rows }
  const entries = allocations[store]
  if (entries === undefined) return { rows }
  if (!Array.isArray(entries)) return { rows, error: `门店「${store}」的发票映射格式无效` }

  const byId = new Map(invoices.map(invoice => [invoice.id, invoice]))

  for (const entry of entries) {
    if (!entry || !Number.isInteger(entry.rowIndex) || entry.rowIndex < 0 || entry.rowIndex >= rowCount) {
      return { rows: new Map(), error: `门店「${store}」的明细行索引超出范围` }
    }
    if (typeof entry.amount !== 'number' || !Number.isFinite(entry.amount) || entry.amount < 0) {
      return { rows: new Map(), error: `门店「${store}」的分摊金额无效` }
    }
    const mappedInvoices: InvoiceLike[] = []
    for (const invoiceId of entry.invoiceIds || []) {
      const invoice = byId.get(Number(invoiceId))
      if (!invoice) {
        return { rows: new Map(), error: `门店「${store}」的发票映射引用了不存在的发票` }
      }
      mappedInvoices.push(invoice)
    }
    const existing = rows.get(entry.rowIndex)
    if (existing) {
      existing.amount += entry.amount
      existing.invoices.push(...mappedInvoices)
    } else {
      rows.set(entry.rowIndex, { amount: entry.amount, invoices: mappedInvoices })
    }
  }

  return { rows }
}

