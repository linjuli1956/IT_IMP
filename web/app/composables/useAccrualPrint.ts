/**
 * 计提表打印 composable（P2 修复：数据多时打印显示不完整）
 *
 * 视觉基线：HEAD 中 A5 打印实现（标题 + 完整表格：表头/边框/列宽/行高/小计/合计/制表人）。
 * 本实现修复基线中「固定高度 148mm + overflow:hidden 裁剪」导致的截断问题：
 *
 * A5（自动压缩，输出在 A4 纵向纸上，打印后裁切）：
 * - 统一使用 @page A4 纵向；每张 A4 固定两个上下排列的横向 A5 槽位（210×148mm）；
 * - 隐藏 DOM 测量区（Shadow DOM，CSS 与最终打印区完全一致）测量内容自然高度；
 * - 高度统一按像素计算（96dpi，mm→px 换算），禁止 px/mm 直接相除；
 * - 缩放始终以「单个 A5 槽位的可用高度」计算，绝不按整张 A4 高度；
 * - 单张 A5：输出一张 A4，计提表只放上半槽位，下半槽位留空供沿中线裁切；
 * - 批量 A5：每份独立测量缩放，第一、二份占同一张 A4 的上/下槽位，
 *   第三份从下一张 A4 上半槽位开始，只在每张 A4 后分页；
 * - 禁止 overflow:hidden / 固定高度裁剪 / 嵌套完整 HTML 文档。
 *
 * A4（自动分页）：
 * - A4 纵向、正常可读字号；每份批量计提表从新 A4 页开始；
 * - 手动分页（computePageBreaks）：数据行不拆分、小计与本组最后一条数据同页、
 *   合计与制表人只在内容流末尾（最后一页），表头由 thead 每页重复；
 * - 不使用会重复的 tfoot；无固定高度、无裁剪。
 *
 * 所有动态打印字段统一经 escapeHtml 转义；null/undefined 输出空字符串。
 */

import type { Accrual } from './useAccrualData'

export type PrintTemplate = 'a5' | 'a4'

export interface AccrualPrintOptions {
  /** 测试注入：测量内容高度（默认使用 DOM getBoundingClientRect） */
  measureHeight?: (el: HTMLElement) => number
  /** 测试注入：测量表格行高（默认读取 tbody 各行实际渲染高度） */
  measureRowHeights?: (table: HTMLElement) => number[]
  /** 测试注入：测量表头高度（默认读取 thead 实际渲染高度） */
  measureHeaderHeight?: (table: HTMLElement) => number
}

export interface PrintResult {
  template: PrintTemplate
  /** A5 单份缩放比 */
  scale?: number
  /** A5 批量每份缩放比（按传入顺序） */
  scales?: number[]
  /** A4 分页断点（tbody 行索引，含小计/合计行） */
  pageBreaks?: number[]
}

// ============================================
// 纯函数（可直接单元测试）
// ============================================

/** 单位换算：96dpi 下 1mm = 96/25.4 px */
const PX_PER_MM = 96 / 25.4

function mmToPx(mm: number): number {
  return mm * PX_PER_MM
}

/** A5 纸张几何尺寸（px） */
const A5_HEIGHT_PX = mmToPx(148)
/** A5 上下留白（px），与 .a5-page/.a5-slot padding 一致 */
const A5_PAD_V_PX = mmToPx(8)
/** A5 左右留白（px） */
const A5_PAD_H_PX = mmToPx(10)
/** 测量安全余量（px）：吸收字体渲染差异，保证不溢出到第二页 */
const A5_SAFETY_PX = 4
/** A5 内容可用高度（px）：单个 A5 槽位（148mm）高度 - 上下留白 - 安全余量 */
const A5_USABLE_HEIGHT_PX = A5_HEIGHT_PX - A5_PAD_V_PX * 2 - A5_SAFETY_PX
/** A4 内容可用高度（px）：297mm - 上下 15mm 留白 */
const A4_CONTENT_HEIGHT_PX = mmToPx(297 - 15 - 15)

/**
 * HTML 实体转义；null/undefined 输出空字符串。
 * 所有动态打印字段（标题、运营商、部门、名称、费用类型、备注等）都必须经过这里。
 * 注意：不导出为模块级函数（app/utils/topology-visual.ts 已有同名自动导入函数，
 * 避免 Nuxt 自动导入撞名），通过 useAccrualPrint() 返回使用。
 */
function escapeHtml(value: unknown): string {
  if (value == null) return ''
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return String(value).replace(/[&<>"']/g, (char) => entities[char] || char)
}

/** 金额格式化：非有限数字输出空字符串，否则保留两位小数 */
export function formatAmount(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  return value.toFixed(2)
}

/**
 * A5 缩放比：内容高度超出可用高度时等比缩小，否则不放大。
 * measuredHeightPx 非法（<=0 / 非有限）时视为无需缩放。
 */
export function computeA5Scale(measuredHeightPx: number, usableHeightPx: number): number {
  if (!Number.isFinite(measuredHeightPx) || measuredHeightPx <= 0) return 1
  if (!Number.isFinite(usableHeightPx) || usableHeightPx <= 0) return 1
  return Math.min(1, usableHeightPx / measuredHeightPx)
}

/**
 * A4 分页断点计算（纯函数）。
 * @param rowHeightsPx 所有 tbody 行（数据行 + 小计行 + 合计行）的实际渲染高度，按输出顺序
 * @param subtotalIndices 小计行在 rowHeightsPx 中的索引
 * @param pageContentHeightPx 单页可用内容高度
 * @param headerHeightPx 每页重复表头（thead）占用的高度，默认 0
 * @returns 需要「从新页开始」的行索引（break-before page）
 *
 * 规则：
 * - 每页行高预算 = 页高 - 表头高；累计超过预算时在该行前分页；
 * - 小计行不得与其上一行（本组最后一条数据）拆到不同页：若断点落在小计行，
 *   把断点前移到本组最后一条数据行之前；若「数据行+小计」本身超过一页
 *   （极端情况）则退化为正常断在小计行前。
 */
export function computePageBreaks(
  rowHeightsPx: number[],
  subtotalIndices: number[],
  pageContentHeightPx: number,
  headerHeightPx = 0,
): number[] {
  const breaks: number[] = []
  const subtotalSet = new Set(subtotalIndices)
  const availablePerPage = Math.max(pageContentHeightPx - headerHeightPx, 1)
  let current = 0

  for (let i = 0; i < rowHeightsPx.length; i++) {
    const h = rowHeightsPx[i] ?? 0
    if (current > 0 && current + h > availablePerPage) {
      let breakIndex = i
      if (subtotalSet.has(i)) {
        // 小计与其上一行同页：找到本组最后一条数据行，断点放在该行之前
        let gluedStart = i
        while (gluedStart > 0 && subtotalSet.has(gluedStart - 1)) gluedStart--
        if (gluedStart > 0) {
          const gluedHeight = sumRange(rowHeightsPx, gluedStart - 1, i)
          if (gluedHeight <= availablePerPage) {
            breakIndex = gluedStart - 1
          }
          // 否则「数据行+小计」本身超一页，保持断在小计行前（极端情况）
        }
      }
      if (breaks[breaks.length - 1] !== breakIndex) {
        breaks.push(breakIndex)
        current = sumRange(rowHeightsPx, breakIndex, i)
        continue
      }
    }
    current += h
  }
  return breaks
}

function sumRange(arr: number[], from: number, to: number): number {
  let sum = 0
  for (let i = from; i <= to; i++) sum += arr[i] ?? 0
  return sum
}

// ============================================
// 行规划：与 buildTableHtml 的输出顺序严格一致
// ============================================

interface RowPlan {
  subtotalIndices: number[]
  totalIndex: number
  rowCount: number
}

function collectRowPlan(accrual: Accrual): RowPlan {
  const hasMultipleGroups = accrual.groups.length > 1
  const subtotalIndices: number[] = []
  let idx = 0
  for (const group of accrual.groups) {
    idx += group.rows.length
    if (hasMultipleGroups) {
      subtotalIndices.push(idx)
      idx++
    }
  }
  const totalIndex = idx
  return { subtotalIndices, totalIndex, rowCount: idx + 1 }
}

// ============================================
// HTML 构建（A5 / A4 复用同一套表格结构）
// ============================================

function joinDept(dept: unknown): string {
  return Array.isArray(dept) ? dept.join('、') : ''
}

/**
 * 构建完整表格 HTML（thead + tbody，合计行放在 tbody 末尾，不使用 tfoot）。
 * @param breakRows A4 分页断点集合（tbody 行索引），命中时给该行加 page-break-row 类
 */
function buildTableHtml(accrual: Accrual, breakRows?: Set<number>): string {
  const hasMultipleGroups = accrual.groups.length > 1
  const hasFeeType = accrual.groups.some(g => g.rows.some(r => r.feeType))
  const plan = collectRowPlan(accrual)
  const breakSet = breakRows ?? new Set<number>()

  let seq = 0
  let rowIndex = 0
  let body = ''

  for (const group of accrual.groups) {
    for (const row of group.rows) {
      seq++
      const classes = breakSet.has(rowIndex) ? ['page-break-row'] : []
      const feeTypeCell = hasFeeType ? `<td class="center">${escapeHtml(row.feeType)}</td>` : ''
      body += `<tr${classes.length ? ` class="${classes.join(' ')}"` : ''}>`
        + `<td class="center">${seq}</td>`
        + `<td>${escapeHtml(joinDept(row.dept))}</td>`
        + `<td>${escapeHtml(row.name)}</td>${feeTypeCell}`
        + `<td class="right">${escapeHtml(formatAmount(row.amount))}</td>`
        + `<td>${escapeHtml(row.remark)}</td>`
        + `</tr>`
      rowIndex++
    }
    if (hasMultipleGroups) {
      const colspan = hasFeeType ? 4 : 3
      const classes = ['subtotal-row']
      if (breakSet.has(rowIndex)) classes.push('page-break-row')
      body += `<tr class="${classes.join(' ')}">`
        + `<td colspan="${colspan}" class="right bold">小计</td>`
        + `<td class="right bold">${escapeHtml(formatAmount(group.subtotal))}</td>`
        + `<td></td>`
        + `</tr>`
      rowIndex++
    }
  }

  const colspan = hasFeeType ? 4 : 3
  const classes = ['total-row']
  if (breakSet.has(plan.totalIndex)) classes.push('page-break-row')
  body += `<tr class="${classes.join(' ')}">`
    + `<td colspan="${colspan}" class="right bold">合计</td>`
    + `<td class="right bold">${escapeHtml(formatAmount(accrual.totalAmount))}</td>`
    + `<td></td>`
    + `</tr>`

  const feeTypeHeader = hasFeeType ? '<th class="center" style="width:65px">费用类型</th>' : ''
  const header = `<tr>`
    + `<th class="center" style="width:40px">序号</th>`
    + `<th style="width:90px">承担部门</th>`
    + `<th>名称/号码</th>${feeTypeHeader}`
    + `<th class="right" style="width:75px">费用(元)</th>`
    + `<th style="width:65px">备注</th>`
    + `</tr>`

  return `<table><thead>${header}</thead><tbody>${body}</tbody></table>`
}

/** 构建标题（含月份转换），动态字段由调用方 escapeHtml 处理 */
function buildTitle(accrual: Accrual): string {
  const monthStr = accrual.feeMonth.replace(/-(\d{2})$/, '年$1月')
  return `${monthStr}${accrual.carrier}计提表`
}

/**
 * 构建计提表主体 HTML（标题 + 表格 + 制表人）。
 * A5 测量区与最终打印区复用同一 HTML；A4 打印同样复用。
 */
function buildBodyHtml(accrual: Accrual, breakRows?: Set<number>): string {
  return `<div class="accrual-title">${escapeHtml(buildTitle(accrual))}</div>`
    + buildTableHtml(accrual, breakRows)
    + `<div class="accrual-footer">制表人：</div>`
}

// ============================================
// CSS（测量区与打印区复用完全相同的 CSS）
// ============================================

/** 表格公共样式（与 HEAD 视觉基线一致：边框、列宽、行高、小计/合计样式） */
const TABLE_CSS = `
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td {
  border: 1px solid #999;
  padding: 7px 8px;
  line-height: 1.6;
  vertical-align: middle;
  height: 36px;
}
th { background: #F5F7FA; font-weight: 600; color: #606266; }
td { color: #303133; word-break: break-word; }
.center { text-align: center; }
.right { text-align: right; }
.bold { font-weight: 700; }
.subtotal-row td { background: #FAFAFA; border-top: 1.5px solid #ccc; }
.total-row td {
  background: #FDF6EC;
  border-top: 2px solid #E6A23C;
  font-size: 1.05em;
}
`

/** 标题 / 制表人样式 */
const TITLE_FOOTER_CSS = `
.accrual-title {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  margin-bottom: ${mmToPx(4)}px;
}
.accrual-footer {
  margin-top: ${mmToPx(3)}px;
  font-size: 13px;
  color: #909399;
}
`

/** A5 内容 CSS：测量区与打印区共用（不含 @page，@page 仅存在于打印文档） */
const A5_CONTENT_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #fff; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
/* 每张 A4 固定两个上下排列的横向 A5 槽位：宽 210mm、高 148mm（裁切线在槽位交界处） */
.a5-slot {
  width: 210mm;
  height: 148mm;
  padding: ${A5_PAD_V_PX}px ${A5_PAD_H_PX}px;
}
.a5-content {
  width: 100%;
  /* 缩放参数（--ps-*）：测量区使用默认值（scale=1），打印时按实测等比缩小 */
  --ps-font: 14px;
  --ps-row-h: 36px;
  --ps-pad-v: 7px;
  --ps-pad-h: 8px;
  --ps-border-w: 1px;
  --ps-title-font: 18px;
  --ps-title-mb: ${mmToPx(4)}px;
  --ps-footer-font: 13px;
  --ps-footer-mt: ${mmToPx(3)}px;
  --ps-subtotal-bw: 1.5px;
  --ps-total-bw: 2px;
}
.a5-content table { font-size: var(--ps-font); }
.a5-content th,
.a5-content td {
  height: var(--ps-row-h);
  padding: var(--ps-pad-v) var(--ps-pad-h);
  border-width: var(--ps-border-w);
}
.a5-content .accrual-title {
  font-size: var(--ps-title-font);
  margin-bottom: var(--ps-title-mb);
}
.a5-content .accrual-footer {
  font-size: var(--ps-footer-font);
  margin-top: var(--ps-footer-mt);
}
.a5-content .subtotal-row td { border-top-width: var(--ps-subtotal-bw); }
.a5-content .total-row td { border-top-width: var(--ps-total-bw); }
${TABLE_CSS}
${TITLE_FOOTER_CSS}
`

/** A4 内容 CSS：测量区与打印区共用（不含 @page） */
const A4_CONTENT_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #fff; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }
.a4-page {
  width: 210mm;
  padding: ${mmToPx(15)}px ${mmToPx(20)}px;
  break-after: page;
  page-break-after: always;
}
.a4-page:last-child {
  break-after: auto;
  page-break-after: auto;
}
thead { display: table-header-group; }
tr { break-inside: avoid; page-break-inside: avoid; }
.page-break-row { break-before: page; page-break-before: always; }
.subtotal-row { break-before: avoid; page-break-before: avoid; }
${TABLE_CSS}
${TITLE_FOOTER_CSS}
`

/**
 * 构建 A5 打印文档 CSS（含 @page）。
 * 产品规则：A5 不输出物理 A5 纸，统一在 A4 纵向纸上输出横向 A5 版式（打印后裁切）。
 */
function buildA5DocCss(): string {
  return `@page { size: A4; margin: 0; }\n`
    + `.a4-page { break-after: page; page-break-after: always; }\n`
    + `.a4-page:last-child { break-after: auto; page-break-after: auto; }\n`
    + A5_CONTENT_CSS
}

/**
 * 构建 A5 缩放内联样式：把等比缩放系数换算为各尺寸的真实 px 值（--ps-* 变量）。
 * 不使用 transform（transform 不影响布局高度，打印时仍会按自然高度溢出分页），
 * 而是让布局本身按缩放后的尺寸渲染，保证完整放进一张 A5。
 */
function buildA5ScaleStyle(scale: number): string {
  return [
    `--ps-font:${(14 * scale).toFixed(4)}px`,
    `--ps-row-h:${(36 * scale).toFixed(4)}px`,
    `--ps-pad-v:${(7 * scale).toFixed(4)}px`,
    `--ps-pad-h:${(8 * scale).toFixed(4)}px`,
    `--ps-border-w:${(scale).toFixed(4)}px`,
    `--ps-title-font:${(18 * scale).toFixed(4)}px`,
    `--ps-title-mb:${(mmToPx(4) * scale).toFixed(4)}px`,
    `--ps-footer-font:${(13 * scale).toFixed(4)}px`,
    `--ps-footer-mt:${(mmToPx(3) * scale).toFixed(4)}px`,
    `--ps-subtotal-bw:${(1.5 * scale).toFixed(4)}px`,
    `--ps-total-bw:${(2 * scale).toFixed(4)}px`,
  ].join(';')
}

/** 构建 A4 打印文档 CSS（含 @page） */
function buildA4DocCss(): string {
  return `@page { size: A4; margin: 0; }\n${A4_CONTENT_CSS}`
}

// ============================================
// 隐藏测量区（Shadow DOM：CSS 与打印区一致，且不影响宿主页面样式）
// ============================================

function createMeasurer(): { host: HTMLElement; root: ShadowRoot } {
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position: fixed; top: -9999px; left: -9999px; width: 0; height: 0; z-index: -1000;'
  const root = host.attachShadow({ mode: 'open' })
  document.body.appendChild(host)
  return { host, root }
}

// ============================================
// Composable
// ============================================

export function useAccrualPrint(options: AccrualPrintOptions = {}) {
  const measureHeight = options.measureHeight
    ?? ((el: HTMLElement) => el.getBoundingClientRect().height)
  const measureRowHeights = options.measureRowHeights
    ?? ((table: HTMLElement) => Array.from(table.querySelectorAll('tbody tr'))
      .map(tr => (tr as HTMLElement).getBoundingClientRect().height))
  const measureHeaderHeight = options.measureHeaderHeight
    ?? ((table: HTMLElement) => table.querySelector('thead')?.getBoundingClientRect().height ?? 0)

  /**
   * 测量 A5 内容自然高度：Shadow DOM 隐藏测量区 + 与打印完全相同的 CSS/HTML。
   * 测量/缩放均以单个 A5 槽位为准（与打印布局一致）。
   */
  function measureA5ContentHeight(accrual: Accrual): number {
    const { host, root } = createMeasurer()
    try {
      root.innerHTML = `<style>${A5_CONTENT_CSS}</style>`
        + `<div class="a5-slot"><div class="a5-content">${buildBodyHtml(accrual)}</div></div>`
      const content = root.querySelector<HTMLElement>('.a5-content')
      if (!content) return 0
      return measureHeight(content)
    } finally {
      document.body.removeChild(host)
    }
  }

  /**
   * 测量 A4 表格布局：各行实际渲染高度（含小计/合计行）+ 表头高度，
   * 表头在每页重复，分页预算需扣除表头高度。
   */
  function measureA4Layout(accrual: Accrual): { rowHeights: number[]; headerHeight: number } {
    const { host, root } = createMeasurer()
    try {
      root.innerHTML = `<style>${A4_CONTENT_CSS}</style>`
        + `<div class="a4-page">${buildBodyHtml(accrual)}</div>`
      const table = root.querySelector<HTMLElement>('table')
      if (!table) return { rowHeights: [], headerHeight: 0 }
      return { rowHeights: measureRowHeights(table), headerHeight: measureHeaderHeight(table) }
    } finally {
      document.body.removeChild(host)
    }
  }

  /**
   * 打开打印窗口并写入完整文档；window.open 被拦截或文档写入失败时抛出异常
   * （调用方据此决定是否更新「已打印」状态）。
   */
  function openPrintWindow(cssContent: string, bodyHtmlContent: string, title: string): void {
    const win = window.open('', '_blank', 'width=900,height=760')
    if (!win) {
      throw new Error('弹出窗口被浏览器拦截，请允许弹窗后重试')
    }
    const fullHtml = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>${cssContent}</style>
</head>
<body>
${bodyHtmlContent}
</body>
</html>`
    try {
      win.document.write(fullHtml)
      win.document.close()
    } catch {
      throw new Error('打印文档生成失败，请重试')
    }
    setTimeout(() => {
      try {
        win.focus()
        win.print()
        win.close()
      } catch {
        // 忽略：打印窗口生命周期结束
      }
    }, 500)
  }

  /** 打印单个计提表 */
  function printAccrual(accrual: Accrual, template: PrintTemplate = 'a5'): PrintResult {
    const title = `计提表打印 (${template.toUpperCase()}) - ${accrual.batchNo}`

    if (template === 'a4') {
      const layout = measureA4Layout(accrual)
      const pageBreaks = computePageBreaks(
        layout.rowHeights,
        collectRowPlan(accrual).subtotalIndices,
        A4_CONTENT_HEIGHT_PX,
        layout.headerHeight,
      )
      const bodyHtml = `<div class="a4-page">${buildBodyHtml(accrual, new Set(pageBreaks))}</div>`
      openPrintWindow(buildA4DocCss(), bodyHtml, title)
      return { template, pageBreaks }
    }

    // A5：独立测量 + 独立缩放，输出一张 A4，计提表放上半槽位、下半槽位留空供裁切
    const measured = measureA5ContentHeight(accrual)
    const scale = computeA5Scale(measured, A5_USABLE_HEIGHT_PX)
    const bodyHtml = `<div class="a4-page">`
      + `<div class="a5-slot"><div class="a5-content" style="${buildA5ScaleStyle(scale)}">${buildBodyHtml(accrual)}</div></div>`
      + `<div class="a5-slot"></div>`
      + `</div>`
    openPrintWindow(buildA5DocCss(), bodyHtml, title)
    return { template, scale }
  }

  /** 批量打印：A5 每份独立测量缩放、两份一张 A4；A4 每份从新页开始 */
  function printAccruals(accruals: Accrual[], template: PrintTemplate = 'a5'): PrintResult {
    if (accruals.length === 0) return { template }
    const batchNos = accruals.map(a => a.batchNo).join(', ')
    const title = `计提表批量打印 (${template.toUpperCase()}) - ${batchNos}`

    if (template === 'a4') {
      const pages = accruals.map(a => {
        const layout = measureA4Layout(a)
        const pageBreaks = computePageBreaks(
          layout.rowHeights,
          collectRowPlan(a).subtotalIndices,
          A4_CONTENT_HEIGHT_PX,
          layout.headerHeight,
        )
        return `<div class="a4-page">${buildBodyHtml(a, new Set(pageBreaks))}</div>`
      }).join('')
      openPrintWindow(buildA4DocCss(), pages, title)
      return { template }
    }

    const scales: number[] = []
    const slots = accruals.map(a => {
      const measured = measureA5ContentHeight(a)
      const scale = computeA5Scale(measured, A5_USABLE_HEIGHT_PX)
      scales.push(scale)
      return `<div class="a5-slot">`
        + `<div class="a5-content" style="${buildA5ScaleStyle(scale)}">`
        + buildBodyHtml(a)
        + `</div></div>`
    })

    // 每张 A4 两个槽位（上/下），第三份从下一张 A4 上半槽位开始，只在每张 A4 后分页
    const pages: string[] = []
    for (let i = 0; i < slots.length; i += 2) {
      pages.push(`<div class="a4-page">${slots[i]}${i + 1 < slots.length ? slots[i + 1] : ''}</div>`)
    }
    openPrintWindow(buildA5DocCss(), pages.join(''), title)
    return { template, scales }
  }

  return {
    printAccrual,
    printAccruals,
    escapeHtml,
  }
}
