/**
 * 计提表打印 composable 单元测试（P2）
 *
 * 真实断言原则：
 * - 不用 expect(true)、不用只查数组长度、不用随机数据、不用注释代替断言；
 * - mock window.open / document.write，校验实际输出的 HTML/CSS 结构；
 * - 覆盖：转义、A5 少量/50条/长名称长备注/独立 scale/批量两份一页、
 *   A4 表头/行与小计规则/合计末页/批量新页、window.open 拦截、document.write 失败。
 */
// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  useAccrualPrint,
  computeA5Scale,
  computePageBreaks,
  formatAmount,
} from './useAccrualPrint'
import type { Accrual, AccrualGroup, AccrualRow } from './useAccrualData'

// ============================================
// 确定性测试数据（不使用随机值）
// ============================================

function makeRow(seq: number, overrides: Partial<AccrualRow> = {}): AccrualRow {
  return {
    seq,
    dept: ['网络部'],
    name: `号码${seq}`,
    amount: 100 + seq,
    feeType: '',
    remark: '',
    source: 'manual',
    ...overrides,
  }
}

function makeGroup(rows: AccrualRow[], overrides: Partial<AccrualGroup> = {}): AccrualGroup {
  const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
  return {
    store: '泰兴总部门店',
    templateId: 0,
    schemeId: 0,
    carrier: '中国电信',
    invoiceAmount: subtotal,
    subtotal,
    reimbursementFormat: '',
    reimbursementCustom: '',
    reimbursementText: '',
    rows,
    ...overrides,
  }
}

function makeAccrual(overrides: Partial<Accrual> = {}): Accrual {
  const groups = overrides.groups ?? [makeGroup([])]
  const totalAmount = overrides.totalAmount
    ?? groups.reduce((sum, g) => sum + g.subtotal, 0)
  return {
    id: 1,
    batchId: 1,
    batchNo: '202608DX01',
    carrier: '中国电信',
    feeMonth: '2026-08',
    method: 'detail',
    groups,
    totalAmount,
    creator: '张三',
    status: 'generated',
    createTime: '2026-08-15 10:00',
    ...overrides,
  }
}

// ============================================
// 打印窗口捕获：mock window.open / document.write
// ============================================

interface CapturedPrint {
  written: string[]
  mockWin: {
    document: { write: (html: string) => void; close: ReturnType<typeof vi.fn> }
    focus: ReturnType<typeof vi.fn>
    print: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
  }
}

function capturePrintWindow(): CapturedPrint {
  const written: string[] = []
  const mockWin = {
    document: {
      write: (html: string) => { written.push(html) },
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
    close: vi.fn(),
  }
  vi.spyOn(window, 'open').mockReturnValue(mockWin as unknown as Window)
  return { written, mockWin }
}

function extractStyleBlock(html: string): string {
  const match = html.match(/<style>([\s\S]*?)<\/style>/)
  return match ? (match[1] ?? '') : ''
}

/** 提取文档中所有 A5 缩放行高（--ps-row-h）值 */
function extractPsRowHeights(html: string): number[] {
  return [...html.matchAll(/--ps-row-h:([\d.]+)px/g)].map(m => Number(m[1]))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

// ============================================
// 转义与金额
// ============================================

describe('escapeHtml', () => {
  const { escapeHtml } = useAccrualPrint()

  it('null/undefined 输出空字符串', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })

  it('空字符串 / 0 / false 按文本输出', () => {
    expect(escapeHtml('')).toBe('')
    expect(escapeHtml(0)).toBe('0')
    expect(escapeHtml(false)).toBe('false')
  })

  it('HTML 特殊字符全部转义', () => {
    expect(escapeHtml('<script>alert("x")&</script>'))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&amp;&lt;/script&gt;')
    expect(escapeHtml("o'clock")).toBe('o&#39;clock')
  })

  it('普通文本不受影响', () => {
    expect(escapeHtml('中国电信 S5735')).toBe('中国电信 S5735')
  })
})

describe('formatAmount', () => {
  it('有限数字保留两位小数', () => {
    expect(formatAmount(123.456)).toBe('123.46')
    expect(formatAmount(100)).toBe('100.00')
    expect(formatAmount(0)).toBe('0.00')
  })

  it('非有限数字输出空字符串', () => {
    expect(formatAmount(null)).toBe('')
    expect(formatAmount(undefined)).toBe('')
    expect(formatAmount('abc')).toBe('')
    expect(formatAmount(Number.NaN)).toBe('')
    expect(formatAmount(Number.POSITIVE_INFINITY)).toBe('')
  })
})

// ============================================
// A5 缩放计算（纯函数）
// ============================================

describe('computeA5Scale', () => {
  it('内容未超出可用高度时不缩放', () => {
    expect(computeA5Scale(500, 1000)).toBe(1)
  })

  it('内容超出可用高度时等比缩小', () => {
    expect(computeA5Scale(2000, 1000)).toBe(0.5)
    expect(computeA5Scale(1000, 250)).toBe(0.25)
  })

  it('非法测量值/可用高度视为无需缩放', () => {
    expect(computeA5Scale(0, 1000)).toBe(1)
    expect(computeA5Scale(-10, 1000)).toBe(1)
    expect(computeA5Scale(Number.NaN, 1000)).toBe(1)
    expect(computeA5Scale(1000, 0)).toBe(1)
  })
})

// ============================================
// A4 分页断点计算（纯函数）
// ============================================

describe('computePageBreaks', () => {
  it('无行时无断点', () => {
    expect(computePageBreaks([], [], 250)).toEqual([])
  })

  it('累计高度超过页高时在该行前分页', () => {
    expect(computePageBreaks([100, 100, 100, 100], [], 250)).toEqual([2])
  })

  it('恰好等于页高不分页', () => {
    expect(computePageBreaks([100, 100, 100], [], 300)).toEqual([])
  })

  it('单行本身超过一页时不在首行前分页', () => {
    expect(computePageBreaks([400, 100], [], 300)).toEqual([1])
  })

  it('小计行断点前移到本组最后一条数据行之前', () => {
    // 行序：d0 d1 小计 d2 d3 小计 合计；页高 250
    const breaks = computePageBreaks([100, 100, 100, 100, 100, 100, 100], [2, 5], 250)
    expect(breaks).toEqual([1, 3, 4, 6])
    // 小计(2) 与行 1 同页（断点在 1 之前），小计(5) 与行 4 同页（断点在 4 之前）
    expect(breaks).not.toContain(2)
    expect(breaks).not.toContain(5)
  })

  it('连续小计（空门店）整体粘连到数据行', () => {
    // 行序：d0 小计 小计 合计；d0+两个小计=300 > 页高 250，极端情况退化为断在小计前
    expect(computePageBreaks([100, 100, 100, 100], [1, 2], 250)).toEqual([2])
  })

  it('扣除每页重复表头高度后分页', () => {
    // 页高 300、表头 50 → 每页行预算 250
    expect(computePageBreaks([100, 100, 100, 100, 100], [], 300, 50)).toEqual([2, 4])
  })
})

// ============================================
// A5 打印文档
// ============================================

describe('A5 打印', () => {
  it('少量数据：完整表格、scale=1、无裁剪无嵌套文档', () => {
    vi.useFakeTimers()
    const cap = capturePrintWindow()
    const accrual = makeAccrual({ groups: [makeGroup([makeRow(1), makeRow(2)])] })
    const { printAccrual } = useAccrualPrint({ measureHeight: () => 300 })

    const result = printAccrual(accrual, 'a5')

    expect(result.template).toBe('a5')
    expect(result.scale).toBe(1)

    const html = cap.written[0] ?? ''
    expect(html.startsWith('<!DOCTYPE html>')).toBe(true)
    // 产品规则：A5 统一在 A4 纵向纸上输出横向 A5 版式（打印后裁切）
    expect(html).toContain('@page { size: A4; margin: 0; }')
    expect(html).not.toContain('A5 landscape')
    // 单张 A5 = 一张 A4：两个固定槽位（210×148mm），表格只放上半槽位、下半槽位留空
    expect((html.match(/<div class="a4-page">/g) ?? []).length).toBe(1)
    expect((html.match(/<div class="a5-slot">/g) ?? []).length).toBe(2)
    const pageBody = html.split('<div class="a4-page">')[1] ?? ''
    const slotParts = pageBody.split('<div class="a5-slot">').slice(1)
    expect(slotParts).toHaveLength(2)
    expect(slotParts[0]).toContain('<table>')
    expect(slotParts[0]).toContain('制表人：')
    // 下半槽位为空（供沿中线裁切）
    expect(pageBody).toContain('<div class="a5-slot"></div>')
    expect(extractStyleBlock(html)).toContain('height: 148mm')
    // 不再有整页居中的 .a5-page 版式
    expect(html).not.toContain('a5-page')
    // 完整表格：标题/表头/边框/合计/制表人（视觉基线）
    expect(html).toContain('2026年08月中国电信计提表')
    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('border: 1px solid #999')
    expect(html).toContain('class="total-row"')
    expect(html).toContain('制表人：')
    // 等比缩放写入（scale=1：布局尺寸即为基线尺寸，无 transform）
    expect(html).toContain('--ps-font:14.0000px')
    expect(extractPsRowHeights(html)).toEqual([36])
    expect(html).not.toContain('transform:')
    // 禁止项：overflow:hidden / tfoot / 嵌套完整文档
    expect(html).not.toContain('overflow: hidden')
    expect(html).not.toContain('<tfoot>')
    const styleBlock = extractStyleBlock(html)
    expect(styleBlock).not.toContain('<!DOCTYPE')
    expect(styleBlock).not.toContain('<html')
    expect(styleBlock).not.toContain('<body')
    // 延时后触发打印
    expect(cap.mockWin.print).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(cap.mockWin.print).toHaveBeenCalledTimes(1)
  })

  it('50 条数据：等比压缩且 50 行 + 合计行全部保留', () => {
    const cap = capturePrintWindow()
    const rows = Array.from({ length: 50 }, (_, i) => makeRow(i + 1, {
      dept: [`部门${(i % 3) + 1}`],
      remark: `备注${i + 1}`,
    }))
    const accrual = makeAccrual({ groups: [makeGroup(rows)] })
    const { printAccrual } = useAccrualPrint({ measureHeight: () => 3000 })

    const result = printAccrual(accrual, 'a5')

    expect(result.scale).toBeLessThan(1)
    const html = cap.written[0] ?? ''
    // 50 数据行 + 1 表头行 + 1 合计行 = 52 个 <tr
    expect((html.match(/<tr/g) ?? []).length).toBe(52)
    // 末行与合计未丢失
    expect(html).toContain('号码50')
    expect(html).toContain('合计')
    // 缩放系数真实写入（行高被缩小）
    const rowHeights = extractPsRowHeights(html)
    expect(rowHeights).toHaveLength(1)
    expect(rowHeights[0]).toBeLessThan(36)
  })

  it('长名称/长备注完整保留且转义', () => {
    const cap = capturePrintWindow()
    const longName = '跨域专线<a>&"终端设备-'.repeat(5)
    const longRemark = '这是一条很长的备注信息'.repeat(20)
    const accrual = makeAccrual({
      groups: [makeGroup([makeRow(1, { name: longName, remark: longRemark })])],
    })
    const { printAccrual, escapeHtml } = useAccrualPrint({ measureHeight: () => 400 })

    printAccrual(accrual, 'a5')

    const html = cap.written[0] ?? ''
    expect(html).toContain(escapeHtml(longName))
    expect(html).toContain(escapeHtml(longRemark))
    // 原始（含 < > & "）不得原样出现
    expect(html).not.toContain(longName)
  })

  it('标题（费用月+运营商）转义', () => {
    const cap = capturePrintWindow()
    const accrual = makeAccrual({ carrier: '中国电信<A>&' })
    const { printAccrual } = useAccrualPrint({ measureHeight: () => 300 })

    printAccrual(accrual, 'a5')

    expect(cap.written[0]).toContain('2026年08月中国电信&lt;A&gt;&amp;计提表')
  })

  it('批量 A5：每份独立测量缩放，两份一张 A4，仅第二份后分页', () => {
    const cap = capturePrintWindow()
    const big = makeAccrual({
      id: 1,
      batchNo: '202608DX01',
      groups: [makeGroup(Array.from({ length: 50 }, (_, i) => makeRow(i + 1)))],
    })
    const small1 = makeAccrual({ id: 2, batchNo: '202608DX02', groups: [makeGroup([makeRow(1), makeRow(2)])] })
    const small2 = makeAccrual({ id: 3, batchNo: '202608DX03', groups: [makeGroup([makeRow(1)])] })
    const { printAccruals } = useAccrualPrint({
      // 行数多（>20 行）视为内容高 → 该份独立缩小；其余两份不缩小
      measureHeight: (el) => (el.querySelectorAll('tr').length > 20 ? 3000 : 300),
    })

    const result = printAccruals([big, small1, small2], 'a5')

    expect(result.template).toBe('a5')
    expect(result.scales).toHaveLength(3)
    expect(result.scales![0]).toBeLessThan(1)
    expect(result.scales![1]).toBe(1)
    expect(result.scales![2]).toBe(1)

    const html = cap.written[0] ?? ''
    // 3 份 → 2 个 A4 容器（第 1 张 A4 两份上/下槽位、第 2 张仅上半槽位一份）
    expect((html.match(/<div class="a4-page">/g) ?? []).length).toBe(2)
    expect((html.match(/<div class="a5-slot">/g) ?? []).length).toBe(3)
    // A4 容器承载，只在每张 A4 后分页
    expect(html).toContain('@page { size: A4; margin: 0; }')
    expect(extractStyleBlock(html)).toContain('.a4-page { break-after: page; page-break-after: always; }')
    // 槽位固定 210×148mm
    expect(extractStyleBlock(html)).toContain('height: 148mm')
    expect(html).not.toContain('a5-page')
    // 同一文档中同时存在缩小与不缩小的两份（独立缩放）
    const rowHeights = extractPsRowHeights(html)
    expect(rowHeights).toHaveLength(3)
    expect(rowHeights[0]).toBeLessThan(36)
    expect(rowHeights[1]).toBe(36)
    expect(rowHeights[2]).toBe(36)
    // 第一份完整（末行在）
    expect(html).toContain('号码50')
  })
})

// ============================================
// A4 打印文档
// ============================================

describe('A4 打印', () => {
  it('单份：表头重复/行不拆分/小计规则/无 tfoot/合计与制表人末尾', () => {
    const cap = capturePrintWindow()
    const accrual = makeAccrual({
      groups: [
        makeGroup([makeRow(1), makeRow(2)], { store: '门店A' }),
        makeGroup([makeRow(3), makeRow(4)], { store: '门店B' }),
      ],
    })
    // 7 行（2 数据 + 小计 + 2 数据 + 小计 + 合计），每行 350px（页高 ~1009px 触发断点）
    const { printAccrual } = useAccrualPrint({ measureRowHeights: () => Array(7).fill(350) })

    const result = printAccrual(accrual, 'a4')

    expect(result.template).toBe('a4')
    expect(result.pageBreaks).toEqual([1, 3, 4, 6])

    const html = cap.written[0] ?? ''
    expect(html).toContain('@page { size: A4; margin: 0; }')
    // 每页重复表头
    expect(html).toContain('thead { display: table-header-group; }')
    // 数据行不拆分
    expect(html).toContain('tr { break-inside: avoid; page-break-inside: avoid; }')
    // 小计与本组最后一条数据同页（CSS 兜底 + 手动断点前移）
    expect(html).toContain('.subtotal-row { break-before: avoid; page-break-before: avoid; }')
    // 合计行不使用 tfoot（不重复），在 tbody 末尾（可能带 page-break-row 类）
    expect(html).not.toContain('<tfoot>')
    expect(html).toContain('class="total-row')
    // 制表人在表格（合计）之后
    expect(html.indexOf('制表人：')).toBeGreaterThan(html.indexOf('合计'))
    // 手动分页行：4 个断点 → 4 个 page-break-row（只统计 body 内的行类，排除 CSS 选择器）
    const bodyPart = html.slice(html.indexOf('</style>'))
    expect((bodyPart.match(/page-break-row/g) ?? []).length).toBe(4)
    // 无固定高度裁剪
    expect(html).not.toContain('overflow: hidden')
  })

  it('批量 A4：每份从新 A4 页开始，互不混排', () => {
    const cap = capturePrintWindow()
    const a1 = makeAccrual({ id: 1, batchNo: 'B001', groups: [makeGroup([makeRow(1)])] })
    const a2 = makeAccrual({ id: 2, batchNo: 'B002', groups: [makeGroup([makeRow(1), makeRow(2)])] })
    const { printAccruals } = useAccrualPrint({ measureRowHeights: () => [100, 100] })

    printAccruals([a1, a2], 'a4')

    const html = cap.written[0] ?? ''
    const containers = html.split('<div class="a4-page">').slice(1)
    expect(containers).toHaveLength(2)
    // 每份含表头行：第一份 1 数据行 + 表头 + 合计 = 3 行；第二份 2 数据行 + 表头 + 合计 = 4 行
    expect(((containers[0] ?? '').match(/<tr/g) ?? []).length).toBe(3)
    expect(((containers[1] ?? '').match(/<tr/g) ?? []).length).toBe(4)
    // 每份独立成页：容器后分页，仅最后一个不强制（A4 CSS 为多行规则）
    const styleBlock = extractStyleBlock(html)
    expect(styleBlock).toContain('.a4-page {')
    expect(styleBlock).toContain('break-after: page;')
    expect(styleBlock).toContain('page-break-after: always;')
    expect(styleBlock).toContain('.a4-page:last-child')
    expect(styleBlock).toContain('break-after: auto;')
  })
})

// ============================================
// 失败路径
// ============================================

describe('打印失败路径', () => {
  it('window.open 被拦截时抛出异常（详情页据此不更新已打印状态）', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)
    const { printAccrual } = useAccrualPrint({ measureHeight: () => 300 })
    const accrual = makeAccrual()

    expect(() => printAccrual(accrual, 'a5')).toThrow('弹出窗口被浏览器拦截')
    expect(() => printAccrual(accrual, 'a4')).toThrow('弹出窗口被浏览器拦截')
  })

  it('document.write 抛错时抛出异常（不视为打印成功）', () => {
    const mockWin = {
      document: {
        write: vi.fn(() => { throw new Error('write boom') }),
        close: vi.fn(),
      },
      focus: vi.fn(),
      print: vi.fn(),
      close: vi.fn(),
    }
    vi.spyOn(window, 'open').mockReturnValue(mockWin as unknown as Window)
    const { printAccrual } = useAccrualPrint({ measureHeight: () => 300 })

    expect(() => printAccrual(makeAccrual(), 'a5')).toThrow('打印文档生成失败')
  })
})
