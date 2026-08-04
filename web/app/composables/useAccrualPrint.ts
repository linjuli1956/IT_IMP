/**
 * 计提表打印 composable
 * 使用 CSS @media print 实现 A5-on-A4 双页布局
 * A5尺寸：210×148mm，2张A5上下排布在1张A4（210×297mm）上
 *
 * 打印规则：
 * - 一个批次（Accrual）= 一个A5，所有门店行合并到同一个表格
 * - 多门店时每个门店后显示小计行，最后显示合计行
 * - 单门店时只显示合计行（不需要小计）
 * - 行数少时整体居中，行数多时自动紧凑
 * - 批量打印时每2个A5排一张A4
 */

import type { Accrual } from './useAccrualData'

export function useAccrualPrint() {
  /**
   * 生成整个计提表的A5打印HTML（所有门店合并到一个A5）
   */
  function generateAccrualHtml(accrual: Accrual): string {
    const monthStr = accrual.feeMonth.replace(/-(\d{2})$/, '年$1月')
    const title = `${monthStr}${accrual.carrier}计提表`

    const hasMultipleGroups = accrual.groups.length > 1
    const hasFeeType = accrual.groups.some(g => g.rows.some(r => r.feeType))

    // 生成表格行（按门店分组，多门店时每组后加小计）
    let seqCounter = 0
    let bodyHtml = ''

    for (const group of accrual.groups) {
      // 门店数据行
      for (const row of group.rows) {
        seqCounter++
        const feeTypeCell = hasFeeType ? `<td class="center">${row.feeType || '—'}</td>` : ''
        bodyHtml += `
          <tr>
            <td class="center">${seqCounter}</td>
            <td>${row.dept.join('、')}</td>
            <td>${row.name}</td>${feeTypeCell}
            <td class="right">${row.amount.toFixed(2)}</td>
            <td>${row.remark || ''}</td>
          </tr>`
      }
      // 小计行（仅多门店时显示）
      if (hasMultipleGroups) {
        const subtotalColspan = hasFeeType ? 4 : 3
        bodyHtml += `
          <tr class="subtotal-row">
            <td colspan="${subtotalColspan}" class="right bold">小计</td>
            <td class="right bold">${group.subtotal.toFixed(2)}</td>
            <td></td>
          </tr>`
      }
    }

    // 合计行（始终显示）
    const totalColspan = hasFeeType ? 4 : 3
    const tfootHtml = `
        <tfoot>
          <tr class="total-row">
            <td colspan="${totalColspan}" class="right bold">合计</td>
            <td class="right bold">${accrual.totalAmount.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>`

    // 计算总行数判断布局模式
    const totalRows = seqCounter + 1 + (hasMultipleGroups ? accrual.groups.length : 0) + 1
    const sizeClass = totalRows > 8 ? 'compact' : ''
    const feeTypeHeader = hasFeeType ? '<th class="center" style="width:65px">费用类型</th>' : ''

    return `
      <div class="a5-page ${sizeClass}">
        <div class="header">
          <div class="title">${title}</div>
        </div>
        <div class="table-area">
          <table>
            <thead>
              <tr>
                <th class="center" style="width:40px">序号</th>
                <th style="width:90px">承担部门</th>
                <th>名称/号码</th>${feeTypeHeader}
                <th class="right" style="width:75px">费用(元)</th>
                <th style="width:65px">备注</th>
              </tr>
            </thead>
            <tbody>
              ${bodyHtml}
            </tbody>${tfootHtml}
          </table>
        </div>
        <div class="footer">制表人：</div>
      </div>
    `
  }

  /**
   * 打开打印窗口并触发打印
   */
  function openPrintWindow(htmlContent: string, title: string) {
    const win = window.open('', '_blank', 'width=800,height=600')
    if (!win) {
      throw new Error('弹出窗口被浏览器拦截，请允许弹窗后重试')
    }

    win.document.write(`<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  /* 打印窗口 HTML 模板，独立文档无法引用 tokens.css 的 CSS 变量。
     颜色值与 tokens.css 保持一致：#303133=--text-primary, #606266=--text-regular,
     #909399=--color-info, #F5F7FA=--bg-page, #FDF6EC=--color-warning-light,
     #E6A23C=--color-primary, #FAFAFA=浅灰背景, #999/#ccc=边框灰 */
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #fff; font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif; }

  .a5-page {
    width: 210mm;
    height: 148mm;
    padding: 8mm 10mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .header {
    text-align: center;
    margin-bottom: 4mm;
    flex-shrink: 0;
  }
  .title {
    font-size: 18px;
    font-weight: 700;
    color: #303133;
  }

  /* 表格区域自然高度，内容少时适当留白 */
  .table-area {
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th, td {
    border: 1px solid #999;
    padding: 7px 8px;
    line-height: 1.6;
    vertical-align: middle;
    height: 36px;
  }
  th {
    background: #F5F7FA;
    font-weight: 600;
    color: #606266;
  }
  td {
    color: #303133;
    word-break: break-word;
  }
  .center { text-align: center; }
  .right { text-align: right; }
  .bold { font-weight: 700; }

  /* 小计行（门店分组） */
  .subtotal-row td {
    background: #FAFAFA;
    border-top: 1.5px solid #ccc;
  }

  /* 合计行 */
  .total-row td {
    background: #FDF6EC;
    border-top: 2px solid #E6A23C;
    font-size: 1.05em;
  }

  .footer {
    flex-shrink: 0;
    margin-top: 3mm;
    font-size: 13px;
    color: #909399;
  }

  /* 紧凑模式：行数多时缩小字体和行高，从顶部开始不居中 */
  .a5-page.compact {
    justify-content: flex-start;
  }
  .a5-page.compact .title {
    font-size: 16px;
  }
  .a5-page.compact table {
    font-size: 12px;
  }
  .a5-page.compact th,
  .a5-page.compact td {
    padding: 4px 6px;
    height: 28px;
    line-height: 1.4;
  }
  .a5-page.compact .footer {
    font-size: 12px;
  }

  /* 紧凑排布：每2个A5排一张A4，偶数位A5后分页 */
  .a5-page:nth-child(even) {
    page-break-after: always;
  }
  .a5-page:last-child {
    page-break-after: auto;
  }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`)
    win.document.close()

    setTimeout(() => {
      try {
        win.focus()
        win.print()
        win.close()
      } catch (e) {
        // ignore
      }
    }, 500)
  }

  /**
   * 打印单个计提表（一个批次一个A5）
   */
  function printAccrual(accrual: Accrual) {
    const html = generateAccrualHtml(accrual)
    openPrintWindow(html, `计提表打印 - ${accrual.batchNo}`)
  }

  /**
   * 批量打印多个计提表（每个批次一个A5，每2个A5排一张A4）
   */
  function printAccruals(accruals: Accrual[]) {
    if (accruals.length === 0) return
    const html = accruals.map(a => generateAccrualHtml(a)).join('')
    const batchNos = accruals.map(a => a.batchNo).join(', ')
    openPrintWindow(html, `计提表批量打印 - ${batchNos}`)
  }

  return {
    printAccrual,
    printAccruals,
  }
}
