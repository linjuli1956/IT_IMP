/**
 * 发票 → 计提明细行 映射工具单元测试
 * 真实断言：等分舍入精度、默认 1:1 规则、备注拼接、映射反转。
 */
import { describe, it, expect } from 'vitest'
import {
  splitInvoiceAmount,
  buildDefaultInvoiceMapping,
  buildInvoiceRemark,
  invertInvoiceMapping,
  resolveStoreInvoiceAllocations,
  type InvoiceLike,
} from './invoice-allocation'

function invoice(id: number, amount: number, overrides: Partial<InvoiceLike> = {}): InvoiceLike {
  return { id, amount, ...overrides }
}

describe('splitInvoiceAmount', () => {
  it('整除时平均分配', () => {
    expect(splitInvoiceAmount(100, 4)).toEqual([25, 25, 25, 25])
    expect(splitInvoiceAmount(1200, 2)).toEqual([600, 600])
  })

  it('除不尽时余数进末行，合计精确等于原金额', () => {
    expect(splitInvoiceAmount(100, 3)).toEqual([33.33, 33.33, 33.34])
    expect(splitInvoiceAmount(0.01, 3)).toEqual([0, 0, 0.01])
    expect(splitInvoiceAmount(1000, 6)).toEqual([166.66, 166.66, 166.66, 166.66, 166.66, 166.7])
  })

  it('分摊后合计与原金额一致（逐个校验）', () => {
    for (const amount of [100, 0.01, 123.45, 999.99, 7]) {
      for (const count of [1, 2, 3, 4, 7]) {
        const parts = splitInvoiceAmount(amount, count)
        const sum = parts.reduce((s, v) => s + v, 0)
        expect(Math.round(sum * 100) / 100).toBe(Math.round(amount * 100) / 100)
      }
    }
  })

  it('非法输入返回空数组', () => {
    expect(splitInvoiceAmount(100, 0)).toEqual([])
    expect(splitInvoiceAmount(100, -1)).toEqual([])
    expect(splitInvoiceAmount(100, 1.5)).toEqual([])
    expect(splitInvoiceAmount(Number.NaN, 3)).toEqual([])
  })
})

describe('buildDefaultInvoiceMapping', () => {
  const four = [invoice(11, 100), invoice(12, 200), invoice(13, 300), invoice(14, 400)]

  it('发票数 = 行数时按顺序 1:1', () => {
    const map = buildDefaultInvoiceMapping(four, 4)
    expect(map.size).toBe(4)
    expect(map.get(11)).toEqual([0])
    expect(map.get(12)).toEqual([1])
    expect(map.get(13)).toEqual([2])
    expect(map.get(14)).toEqual([3])
  })

  it('数量不相等时返回空映射（要求手动选择）', () => {
    expect(buildDefaultInvoiceMapping(four, 3).size).toBe(0)
    expect(buildDefaultInvoiceMapping(four, 5).size).toBe(0)
    expect(buildDefaultInvoiceMapping([], 4).size).toBe(0)
    expect(buildDefaultInvoiceMapping(four, 0).size).toBe(0)
  })
})

describe('buildInvoiceRemark', () => {
  it('追加发票号与开票日期', () => {
    const remark = buildInvoiceRemark('月租费', [
      invoice(1, 100, { invoiceNumber: '01234567', invoiceDate: '2026-09-01' }),
    ])
    expect(remark).toBe('月租费（发票号 01234567 2026-09-01）')
  })

  it('多张发票用「；」连接', () => {
    const remark = buildInvoiceRemark('', [
      invoice(1, 100, { invoiceNumber: 'A1' }),
      invoice(2, 200, { invoiceNumber: 'A2', invoiceDate: '2026-09-02' }),
    ])
    expect(remark).toBe('（发票号 A1；发票号 A2 2026-09-02）')
  })

  it('无发票号且无日期时返回原备注', () => {
    expect(buildInvoiceRemark('月租费', [invoice(1, 100)])).toBe('月租费')
    expect(buildInvoiceRemark('', [])).toBe('')
  })
})

describe('invertInvoiceMapping', () => {
  it('按行索引汇总对应发票', () => {
    const invoices = [invoice(1, 100), invoice(2, 200), invoice(3, 300)]
    const mapping = new Map<number, number[]>([
      [1, [0, 1]],
      [2, [1]],
      [3, [2]],
    ])
    const inverted = invertInvoiceMapping(mapping, invoices)
    expect(inverted.get(0)?.map(i => i.id)).toEqual([1])
    expect(inverted.get(1)?.map(i => i.id)).toEqual([1, 2])
    expect(inverted.get(2)?.map(i => i.id)).toEqual([3])
  })

  it('忽略不存在的发票ID', () => {
    const invoices = [invoice(1, 100)]
    const inverted = invertInvoiceMapping(new Map([[99, [0]]]), invoices)
    expect(inverted.size).toBe(0)
  })
})

describe('resolveStoreInvoiceAllocations', () => {
  const invoices = [invoice(11, 100), invoice(12, 200), invoice(13, 300)]

  it('未传分配或门店无分配时返回空映射（沿用原有规则）', () => {
    expect(resolveStoreInvoiceAllocations(undefined, '钟山宝龙店', 4, invoices).rows.size).toBe(0)
    expect(resolveStoreInvoiceAllocations({}, '钟山宝龙店', 4, invoices).rows.size).toBe(0)
    expect(resolveStoreInvoiceAllocations({ 其它店: [] }, '钟山宝龙店', 4, invoices).rows.size).toBe(0)
  })

  it('正常解析：行索引、金额、发票', () => {
    const result = resolveStoreInvoiceAllocations({
      钟山宝龙店: [
        { rowIndex: 0, amount: 100, invoiceIds: [11] },
        { rowIndex: 1, amount: 200, invoiceIds: [12] },
      ],
    }, '钟山宝龙店', 4, invoices)
    expect(result.error).toBeUndefined()
    expect(result.rows.size).toBe(2)
    expect(result.rows.get(0)?.amount).toBe(100)
    expect(result.rows.get(0)?.invoices.map(i => i.id)).toEqual([11])
    expect(result.rows.get(1)?.amount).toBe(200)
  })

  it('同一行多次分配时金额相加、发票合并', () => {
    const result = resolveStoreInvoiceAllocations({
      钟山宝龙店: [
        { rowIndex: 0, amount: 100, invoiceIds: [11] },
        { rowIndex: 0, amount: 200, invoiceIds: [12] },
      ],
    }, '钟山宝龙店', 4, invoices)
    expect(result.rows.get(0)?.amount).toBe(300)
    expect(result.rows.get(0)?.invoices.map(i => i.id)).toEqual([11, 12])
  })

  it('行索引越界返回错误', () => {
    const result = resolveStoreInvoiceAllocations({
      钟山宝龙店: [{ rowIndex: 4, amount: 100, invoiceIds: [11] }],
    }, '钟山宝龙店', 4, invoices)
    expect(result.error).toBeTruthy()
    expect(result.rows.size).toBe(0)
  })

  it('金额非法返回错误', () => {
    const negative = resolveStoreInvoiceAllocations({
      钟山宝龙店: [{ rowIndex: 0, amount: -1, invoiceIds: [] }],
    }, '钟山宝龙店', 4, invoices)
    expect(negative.error).toBeTruthy()
    const nan = resolveStoreInvoiceAllocations({
      钟山宝龙店: [{ rowIndex: 0, amount: Number.NaN, invoiceIds: [] }],
    }, '钟山宝龙店', 4, invoices)
    expect(nan.error).toBeTruthy()
  })

  it('引用不存在的发票返回错误', () => {
    const result = resolveStoreInvoiceAllocations({
      钟山宝龙店: [{ rowIndex: 0, amount: 100, invoiceIds: [999] }],
    }, '钟山宝龙店', 4, invoices)
    expect(result.error).toBeTruthy()
  })
})
