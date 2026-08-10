/**
 * 预算管理 共享数据源
 * 数据来自后端 API，全局单例共享
 */

import { useApi, getApiErrorMessage } from './useApi'
import { ElMessage } from 'element-plus'
import ExcelJS from 'exceljs'
import { useSettingsData } from './useSettingsData'
import {
  getFiscalYearMonths, getMonthLabel, isFeeActiveInMonth, formatFeeRange, shiftFeeRangeByYear,
} from '~/utils/fiscal'
import type { BudgetDetail, BudgetExecution } from '~/types/budget'
export type { BudgetDetail, BudgetExecution }

/** 预算导入模板列（与后端 web/server/utils/budget-import.ts 的表头保持一致） */
export const BUDGET_TEMPLATE_COLUMNS = [
  '财年', '门店', '运营商', '费用类型', '月费(元)', '年费(元)', '费用范围', '宽带类型', '缴费方式', '备注',
]

// 运营商选项
export const budgetCarriers = ['电信', '移动', '联通', '其他']

// 费用类型选项
export const budgetFeeTypes = ['宽带', '固话手机', '物联网', '监控', '云服务']

// 门店分类配色映射
export const storeCategoryMap: Record<string, { category: string; color: string }> = {
  '总部信息部': { category: '总部', color: 'var(--color-primary)' },
  '团购部': { category: '总部', color: 'var(--color-primary)' },
  '物流中心昌稷业': { category: '物流', color: 'var(--color-success)' },
  '物流中心昌稷源': { category: '物流', color: 'var(--color-success)' },
}
// 默认分类（未在映射中的门店）
export const defaultStoreCategory = { category: '门店', color: 'var(--color-info)' }

/** 获取门店分类信息 */
export function getStoreCategory(storeName: string) {
  return storeCategoryMap[storeName] ?? defaultStoreCategory
}

// 全局共享状态（单例）
const budgetDetails = ref<BudgetDetail[]>([])
const budgetExecutions = ref<BudgetExecution[]>([])
const loading = ref(false)

async function fetchDetails(params?: { fiscalYear?: number; storeName?: string; carrier?: string }) {
  loading.value = true
  try {
    const { get } = useApi()
    budgetDetails.value = await get<BudgetDetail[]>('/api/budgets', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}

async function fetchExecutions(params?: { fiscalYear?: number; month?: string }) {
  try {
    const { get } = useApi()
    budgetExecutions.value = await get<BudgetExecution[]>('/api/budgets/executions', { query: params })
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

async function addDetail(data: Omit<BudgetDetail, 'id'>) {
  const { post } = useApi()
  await post('/api/budgets', data)
  await fetchDetails()
}

async function updateDetail(id: number, data: Partial<BudgetDetail>) {
  const { put } = useApi()
  await put(`/api/budgets/${id}`, data)
  await fetchDetails()
}

async function deleteDetail(id: number) {
  const { delete: del } = useApi()
  await del(`/api/budgets/${id}`)
  await fetchDetails()
}

/** 删除整个财年的预算明细与执行对比数据（事务，不可恢复） */
async function deleteFiscalYear(year: number): Promise<{ detailCount: number; executionCount: number }> {
  const { delete: del } = useApi()
  const result = await del<{ success: boolean; detailCount: number; executionCount: number }>(`/api/budgets/fiscal-year/${year}`)
  await Promise.all([fetchDetails(), fetchExecutions()])
  return { detailCount: result.detailCount, executionCount: result.executionCount }
}

/** 导入失败时后端返回的错误明细（含 Excel 行号与原因） */
export interface BudgetImportErrorItem {
  row: number
  message: string
}

/** 下载预算明细导入模板（xlsx）：表头加粗底色、关键列下拉与格式批注 */
async function downloadBudgetTemplate() {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('预算模板')
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const headerRow = ws.addRow(BUDGET_TEMPLATE_COLUMNS)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6EC' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

  // 示例行（浅色底纹；门店为"示例门店"，导入解析时会自动跳过，也可手动删除）
  const exampleRow = ws.addRow([
    2026, '示例门店', '电信', '宽带', 100, 1200, '2026-04~2027-03', '100M', '月缴费',
    '示例行：参照本行填写后删除本行',
  ])
  exampleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } }
  exampleRow.font = { color: { argb: 'FF909399' } }
  ws.getCell(2, 1).note = '示例行：参照本行格式填写，导入前请删除本行（导入时系统会自动跳过）'

  const widths = [10, 18, 10, 12, 12, 12, 22, 16, 12, 40]
  widths.forEach((width, i) => { ws.getColumn(i + 1).width = width })

  // 关键列下拉（数据区域第 2 行起，预留 500 行）
  const setListValidation = (col: number, values: string[]) => {
    for (let r = 2; r <= 500; r++) {
      ws.getCell(r, col).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${values.join(',')}"`] }
    }
  }
  setListValidation(3, budgetCarriers)    // 运营商
  setListValidation(4, budgetFeeTypes)    // 费用类型
  setListValidation(9, ['年缴费', '月缴费']) // 缴费方式

  // 表头批注：字段格式说明
  ws.getCell(1, 1).note = '财年，整数，如 2026（26财年 = 2026年4月~2027年3月）'
  ws.getCell(1, 2).note = '与基础配置中的门店名称保持一致'
  ws.getCell(1, 5).note = '月费金额（元），数字，留空按 0 处理'
  ws.getCell(1, 6).note = '年费金额（元），数字，留空按 0 处理'
  ws.getCell(1, 7).note = '费用范围，格式 YYYY-MM~YYYY-MM，如 2026-04~2027-03；留空表示全年有效'
  ws.getCell(1, 9).note = '缴费方式：年缴费 / 月缴费'

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '预算明细导入模板.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

/** 上传 Excel 导入预算明细（整批拒绝/跳过重复由后端处理），成功后刷新数据 */
async function importBudget(file: File, defaultFeeRange = ''): Promise<{ count: number; skipped: number }> {
  const formData = new FormData()
  formData.append('file', file)
  if (defaultFeeRange) {
    formData.append('defaultFeeRange', defaultFeeRange)
  }
  const { post } = useApi()
  const result = await post<{ success: boolean; count: number; skipped: number }>('/api/budgets/import', formData)
  await fetchDetails()
  return { count: result.count, skipped: result.skipped }
}

export function useBudgetData() {
  /** 财年列表（从数据中动态提取） */
  const fiscalYears = computed(() => {
    const years = [...new Set(budgetDetails.value.map(d => d.fiscalYear))]
    return years.sort((a, b) => a - b)
  })

  /** 获取门店列表（从指定财年明细数据中提取） */
  function getDetailStores(fiscalYear?: number) {
    const details = fiscalYear
      ? budgetDetails.value.filter(d => d.fiscalYear === fiscalYear)
      : budgetDetails.value
    return [...new Set(details.map(d => d.storeName))]
  }

  /** 汇总矩阵：门店×月份（按指定财年，按费用范围逐月计算） */
  function getSummaryMatrix(fiscalYear: number) {
    const { fiscalYearStartMonth } = useSettingsData()
    const yearDetails = budgetDetails.value.filter(d => d.fiscalYear === fiscalYear)
    const months = getFiscalYearMonths(fiscalYear, fiscalYearStartMonth.value)
    const stores = [...new Set(yearDetails.map(d => d.storeName))]
    const rows = stores.map(store => {
      const storeDetails = yearDetails.filter(d => d.storeName === store)
      const row: Record<string, number | string> = { storeName: store }
      let yearTotal = 0
      for (const m of months) {
        // 某月只累算费用范围覆盖该月的费用项
        const monthTotal = storeDetails
          .filter(d => isFeeActiveInMonth(d.feeRange, m))
          .reduce((sum, d) => sum + d.monthlyFee, 0)
        const rounded = Math.round(monthTotal * 100) / 100
        row[m] = rounded
        yearTotal += rounded
      }
      row['subtotal'] = Math.round(yearTotal * 100) / 100
      return row
    })
    // 合计行
    const totalRow: Record<string, number | string> = { storeName: '合计' }
    for (const m of months) {
      totalRow[m] = rows.reduce((sum, r) => sum + (r[m] as number), 0)
    }
    totalRow['subtotal'] = rows.reduce((sum, r) => sum + (r['subtotal'] as number), 0)
    // 每列最大值（用于热力图）
    const colMax: Record<string, number> = {}
    for (const m of months) {
      colMax[m] = Math.max(...rows.map(r => r[m] as number), 0)
    }
    return { rows, totalRow, months, colMax }
  }

  /** 获取某门店某月的费用构成明细（按费用范围过滤） */
  function getMonthBreakdown(storeName: string, month: string, fiscalYear: number) {
    return budgetDetails.value
      .filter(d => d.fiscalYear === fiscalYear
        && d.storeName === storeName
        && isFeeActiveInMonth(d.feeRange, month))
      .map(d => ({
        id: d.id,
        carrier: d.carrier,
        feeType: d.feeType,
        monthlyFee: d.monthlyFee,
        feeRange: d.feeRange,
      }))
  }

  /** 生成下个财年：克隆当前财年全部明细到下一年（通过 API 批量导入） */
  async function generateNextFiscalYear(fromYear: number) {
    const sourceDetails = budgetDetails.value.filter(d => d.fiscalYear === fromYear)
    if (sourceDetails.length === 0) return false
    const nextYear = fromYear + 1
    // 检查目标财年是否已有数据
    const existing = budgetDetails.value.filter(d => d.fiscalYear === nextYear)
    if (existing.length > 0) return false
    // 通过 API 批量导入
    try {
      const { post } = useApi()
      const batchData = sourceDetails.map(d => ({
        fiscalYear: nextYear,
        storeName: d.storeName,
        carrier: d.carrier,
        feeType: d.feeType,
        monthlyFee: d.monthlyFee,
        annualFee: d.annualFee,
        feeRange: shiftFeeRangeByYear(d.feeRange, 1),
        broadbandType: d.broadbandType,
        paymentMethod: d.paymentMethod,
        remark: d.remark,
      }))
      await post('/api/budgets', batchData)
      await fetchDetails()
      return true
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error))
      return false
    }
  }

  return {
    budgetDetails,
    budgetExecutions,
    loading,
    budgetCarriers,
    budgetFeeTypes,
    fiscalYears,
    fetchDetails,
    fetchExecutions,
    getDetailStores,
    getSummaryMatrix,
    getMonthBreakdown,
    generateNextFiscalYear,
    addDetail,
    updateDetail,
    deleteDetail,
    deleteFiscalYear,
    downloadBudgetTemplate,
    importBudget,
  }
}
