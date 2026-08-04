<template>
  <div class="page-container">
    <PageHeader title="预算管理">
      <template #actions>
        <el-button type="primary" @click="handleAddDetail">
          <el-icon><Plus /></el-icon>
          新增明细
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 汇总视图：门店×月份预算矩阵，按费用范围逐月计算（某月只累算该月生效的费用项），每店独立行底色，≥2000元标红，按季度分隔</p>
        <p>2. 鼠标悬停任意月份金额可查看该月费用构成明细；点击"导出Excel"可导出汇总矩阵+明细清单（2个Sheet）</p>
        <p>3. 点击"生成下个财年"可克隆当前财年全部明细到下一年，之后逐条修改差异部分</p>
        <p>4. 明细视图：按门店分组展开，查看运营商×费用类型的月费/年费/费用范围/缴费方式，可切换财年</p>
        <p>5. 执行对比：预算vs实际支出，进度条超100%标红，显示超支预警项数</p>
        <p>6. 点击"新增明细"可添加预算明细项；点击"复制"可基于已有明细快速创建新项</p>
      </div>
    </el-alert>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Wallet" :color="budgetVars.budgetColor" :bg="budgetVars.budgetBg" :value="'¥ ' + totalAnnualBudget.toLocaleString()" label="年度预算总额" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Money" :color="budgetVars.monthlyColor" :bg="budgetVars.monthlyBg" :value="'¥ ' + totalMonthlyBudget.toLocaleString()" label="月度预算合计" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="DataLine" :color="budgetVars.storeColor" :bg="budgetVars.storeBg" :value="detailStores.length + ' 个'" label="预算门店数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="budgetVars.warnColor" :bg="budgetVars.warnBg" :value="overBudgetCount + ' 项'" label="超支预警" />
      </el-col>
    </el-row>

    <el-tabs v-model="activeTab" class="budget-tabs" v-loading="loading">
      <!-- Tab 1: 汇总视图 -->
      <el-tab-pane label="汇总视图" name="summary">
        <div class="card">
          <div class="tab-toolbar">
            <el-select v-model="selectedFiscalYear" style="width: 120px">
              <el-option v-for="y in fiscalYears" :key="y" :label="y + '财年'" :value="y" />
            </el-select>
            <el-button type="warning" plain @click="handleGenerateNextYear">
              <el-icon><CopyDocument /></el-icon>
              生成下个财年
            </el-button>
            <el-button type="success" plain @click="handleExportExcel" :loading="exporting">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
            <span class="tab-hint">{{ selectedFiscalYear }}财年 = {{ selectedFiscalYear }}年4月 ~ {{ selectedFiscalYear + 1 }}年3月，按费用范围逐月计算</span>
          </div>
          <el-table :data="matrixData" border show-summary :summary-method="getSummary" :cell-class-name="getQuarterCellClass" :header-cell-class-name="getQuarterHeaderClass" :row-class-name="getMatrixRowClass" class="matrix-table">
            <el-table-column prop="storeName" label="门店" fixed width="180" header-align="center">
              <template #default="{ row }">
                <div class="store-cell" :style="{ '--indicator-color': getStoreIndicatorColor(row.storeName) }">
                  <span class="store-indicator"></span>
                  <span>{{ row.storeName }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column v-for="m in currentMonths" :key="m" :prop="m" :label="getMonthLabel(m)" min-width="110" align="center">
              <template #default="{ row }">
                <el-tooltip effect="dark" placement="top" :show-after="300" :hide-after="0">
                  <span :class="{ 'amount-high': isHighAmount(row[m]) }" class="amount-cell">{{ formatNum(row[m]) }}</span>
                  <template #content>
                    <div class="fee-breakdown">
                      <div class="breakdown-header">{{ row.storeName }} · {{ getMonthLabel(m) }}</div>
                      <div v-if="getMonthBreakdown(row.storeName, m, selectedFiscalYear).length === 0" class="breakdown-empty">该月无生效费用项</div>
                      <template v-else>
                        <div v-for="item in getMonthBreakdown(row.storeName, m, selectedFiscalYear)" :key="item.id" class="breakdown-item">
                          <span>{{ item.carrier }} · {{ item.feeType }}</span>
                          <span class="breakdown-fee">¥{{ formatNum(item.monthlyFee) }}</span>
                        </div>
                        <div class="breakdown-total">
                          <span>合计</span>
                          <span>¥{{ formatNum(row[m]) }}</span>
                        </div>
                      </template>
                    </div>
                  </template>
                </el-tooltip>
              </template>
            </el-table-column>
            <el-table-column prop="subtotal" label="财年小计" min-width="130" align="center" fixed="right">
              <template #default="{ row }">
                <span class="subtotal-text">{{ formatNum(row.subtotal) }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 明细视图 -->
      <el-tab-pane label="明细视图" name="detail">
        <div class="card">
          <div class="tab-toolbar">
            <el-select v-model="selectedFiscalYear" style="width: 120px">
              <el-option v-for="y in fiscalYears" :key="y" :label="y + '财年'" :value="y" />
            </el-select>
            <el-select v-model="filterStore" placeholder="筛选门店" clearable filterable style="width: 180px">
              <el-option v-for="s in detailStores" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
          <el-collapse v-model="expandedStores" class="detail-collapse">
            <el-collapse-item v-for="store in groupedDetails" :key="store.storeName" :name="store.storeName">
              <template #title>
                <span class="store-title">{{ store.storeName }}</span>
                <span class="store-subtotal">月费小计: ¥{{ formatNum(store.monthlySubtotal) }} | 年费小计: ¥{{ formatNum(store.annualSubtotal) }}</span>
              </template>
              <el-table :data="store.items" border class="detail-table">
                <el-table-column prop="carrier" label="运营商" width="80" />
                <el-table-column prop="feeType" label="费用类型" width="100" />
                <el-table-column prop="monthlyFee" label="月费(元)" width="100" align="right">
                  <template #default="{ row }">{{ formatNum(row.monthlyFee) }}</template>
                </el-table-column>
                <el-table-column prop="annualFee" label="年费(元)" width="100" align="right">
                  <template #default="{ row }">{{ formatNum(row.annualFee) }}</template>
                </el-table-column>
                <el-table-column prop="feeRange" label="费用范围" width="160">
                  <template #default="{ row }">
                    {{ formatFeeRange(row.feeRange) }}
                  </template>
                </el-table-column>
                <el-table-column prop="broadbandType" label="宽带类型" width="120" />
                <el-table-column prop="paymentMethod" label="缴费方式" width="80" />
                <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip />
                <el-table-column label="操作" width="200" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" @click.stop="handleDuplicateDetail(row as BudgetDetail)">复制</el-button>
                    <el-button size="small" @click.stop="handleEditDetail(row as BudgetDetail)">编辑</el-button>
                    <el-button size="small" type="danger" @click.stop="handleDeleteDetail(row as BudgetDetail)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
        </div>
      </el-tab-pane>

      <!-- Tab 3: 执行对比 -->
      <el-tab-pane label="执行对比" name="execution">
        <div class="card">
          <div class="tab-toolbar">
            <el-select v-model="execFilterMonth" placeholder="月份" clearable style="width: 120px">
              <el-option v-for="m in execMonths" :key="m" :label="m" :value="m" />
            </el-select>
            <el-select v-model="execFilterStore" placeholder="门店" clearable filterable style="width: 160px">
              <el-option v-for="s in detailStores" :key="s" :label="s" :value="s" />
            </el-select>
            <el-select v-model="execFilterCarrier" placeholder="运营商" clearable style="width: 100px">
              <el-option v-for="c in budgetCarriers" :key="c" :label="c" :value="c" />
            </el-select>
          </div>
          <!-- 执行概览 -->
          <el-row :gutter="12" class="exec-overview">
            <el-col :span="6">
              <div class="exec-stat"><span class="exec-label">预算总额</span><span class="exec-val">¥{{ formatNum(execTotalBudget) }}</span></div>
            </el-col>
            <el-col :span="6">
              <div class="exec-stat"><span class="exec-label">实际支出</span><span class="exec-val">¥{{ formatNum(execTotalActual) }}</span></div>
            </el-col>
            <el-col :span="6">
              <div class="exec-stat"><span class="exec-label">执行率</span><span class="exec-val" :class="{ 'over': Number(execRate) > 100 }">{{ execRate }}%</span></div>
            </el-col>
            <el-col :span="6">
              <div class="exec-stat"><span class="exec-label">超支项</span><span class="exec-val over">{{ execOverCount }} 项</span></div>
            </el-col>
          </el-row>
          <el-table :data="filteredExecutions" border>
            <el-table-column prop="month" label="月份" width="100" />
            <el-table-column prop="storeName" label="门店" width="140" />
            <el-table-column prop="carrier" label="运营商" width="80" />
            <el-table-column prop="budgetAmount" label="预算(元)" width="100" align="right">
              <template #default="{ row }">{{ formatNum(row.budgetAmount) }}</template>
            </el-table-column>
            <el-table-column prop="actualAmount" label="实际(元)" width="100" align="right">
              <template #default="{ row }">
                <span :class="{ 'amount-over': row.actualAmount > row.budgetAmount }">{{ formatNum(row.actualAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="执行率" min-width="280">
              <template #default="{ row }">
                <el-tooltip effect="dark" placement="top" :show-after="300" :hide-after="0">
                  <div class="execution-cell">
                    <el-progress
                      :percentage="getExecRate(row as BudgetExecution)"
                      :color="getProgressColor(row as BudgetExecution)"
                      :stroke-width="14"
                      :text-inside="true"
                      :format="() => getRealExecRate(row as BudgetExecution) + '%'"
                      style="flex: 1; min-width: 140px"
                    />
                    <el-tag v-if="(row as BudgetExecution).actualAmount > (row as BudgetExecution).budgetAmount" type="danger" size="small">超支</el-tag>
                  </div>
                  <template #content>
                    <div class="exec-breakdown">
                      <div class="breakdown-header">{{ row.storeName }} · {{ row.month }} · {{ row.carrier }}</div>
                      <div class="breakdown-item">
                        <span>预算金额</span>
                        <span class="breakdown-fee">¥{{ formatNum(row.budgetAmount) }}</span>
                      </div>
                      <div class="breakdown-item">
                        <span>实际金额</span>
                        <span class="breakdown-fee" :class="{ 'text-over': (row as BudgetExecution).actualAmount > (row as BudgetExecution).budgetAmount }">¥{{ formatNum(row.actualAmount) }}</span>
                      </div>
                      <div class="breakdown-item">
                        <span>差　额</span>
                        <span class="breakdown-fee" :class="{ 'text-over': (row as BudgetExecution).actualAmount > (row as BudgetExecution).budgetAmount }">
                          {{ (row as BudgetExecution).actualAmount > (row as BudgetExecution).budgetAmount ? '+' : '' }}¥{{ formatNum(Math.abs((row as BudgetExecution).actualAmount - (row as BudgetExecution).budgetAmount)) }}（{{ (row as BudgetExecution).actualAmount > (row as BudgetExecution).budgetAmount ? '超支' : '节余' }}）
                        </span>
                      </div>
                      <div class="breakdown-total">
                        <span>执行率</span>
                        <span>{{ getRealExecRate(row as BudgetExecution) }}%</span>
                      </div>
                    </div>
                  </template>
                </el-tooltip>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 明细新增/编辑弹窗 -->
    <el-dialog v-model="detailDialogVisible" :title="detailDialogTitle" width="680px" destroy-on-close>
      <el-form :model="detailForm" label-width="90px" :rules="detailRules" ref="detailFormRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="门店" prop="storeName">
              <el-select v-model="detailForm.storeName" filterable allow-create placeholder="选择或输入门店" style="width: 100%">
                <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="运营商" prop="carrier">
              <el-select v-model="detailForm.carrier" placeholder="选择运营商" style="width: 100%">
                <el-option v-for="c in budgetCarriers" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="费用类型" prop="feeType">
              <el-select v-model="detailForm.feeType" filterable allow-create placeholder="选择或输入" style="width: 100%">
                <el-option v-for="t in budgetFeeTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="缴费方式" prop="paymentMethod">
              <el-select v-model="detailForm.paymentMethod" clearable placeholder="选择缴费方式" style="width: 100%">
                <el-option label="年缴费" value="年缴费" />
                <el-option label="月缴费" value="月缴费" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="月费(元)" prop="monthlyFee">
              <el-input-number v-model="detailForm.monthlyFee" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="年费(元)" prop="annualFee">
              <el-input-number v-model="detailForm.annualFee" :min="0" :precision="2" :controls="false" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="费用范围">
          <el-date-picker
            v-model="feeRangeDate"
            type="monthrange"
            value-format="YYYY-MM"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            clearable
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="宽带类型">
          <el-input v-model="detailForm.broadbandType" placeholder="如：电信家宽、联通商业副宽" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="detailForm.remark" type="textarea" :rows="2" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="detailDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveDetail">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Wallet, Money, DataLine, WarningFilled, CopyDocument, Download } from '@element-plus/icons-vue'
import ExcelJS from 'exceljs'
import {
  useBudgetData, budgetCarriers, budgetFeeTypes,
  getFiscalYearMonths, getMonthLabel, formatFeeRange,
  type BudgetDetail, type BudgetExecution,
} from '~/composables/useBudgetData'
import { useStoreData } from '~/composables/useStoreData'

const {
  budgetDetails, budgetExecutions, loading, fiscalYears,
  fetchDetails, fetchExecutions,
  getDetailStores, getSummaryMatrix, getMonthBreakdown, generateNextFiscalYear,
  addDetail, updateDetail, deleteDetail,
} = useBudgetData()
const { storeOptions } = useStoreData()

// 页面加载时获取预算明细和执行对比数据
onMounted(async () => {
  await fetchDetails()
  await fetchExecutions()
})

const activeTab = ref('summary')
const selectedFiscalYear = ref(2026)

// 当前财年的月份列表
const currentMonths = computed(() => getFiscalYearMonths(selectedFiscalYear.value))
// 当前财年的汇总矩阵
const summaryData = computed(() => getSummaryMatrix(selectedFiscalYear.value))
// 当前财年的门店列表
const detailStores = computed(() => getDetailStores(selectedFiscalYear.value))

// 概览卡片颜色变量
const budgetVars = {
  budgetColor: 'var(--color-info)',
  budgetBg: 'var(--bg-page)',
  monthlyColor: 'var(--color-success)',
  monthlyBg: 'var(--color-success-light)',
  storeColor: 'var(--color-primary)',
  storeBg: 'var(--color-primary-light)',
  warnColor: 'var(--color-danger)',
  warnBg: 'var(--color-danger-light)',
}

// === 概览计算 ===
const yearDetails = computed(() => budgetDetails.value.filter(d => d.fiscalYear === selectedFiscalYear.value))
const totalAnnualBudget = computed(() => yearDetails.value.reduce((s, d) => s + d.annualFee, 0))
const totalMonthlyBudget = computed(() => yearDetails.value.reduce((s, d) => s + d.monthlyFee, 0))
const overBudgetCount = computed(() => {
  return budgetExecutions.value
    .filter(e => e.fiscalYear === selectedFiscalYear.value)
    .filter(e => e.actualAmount > e.budgetAmount).length
})

// === Tab 1: 汇总矩阵 ===
const matrixData = computed(() => summaryData.value.rows)

function getSummary({ columns, data }: { columns: any[]; data: any[] }) {
  const means = columns.map((col, i) => {
    if (i === 0) return '合计'
    const total = data.reduce((sum, row) => sum + (Number(row[col.property]) || 0), 0)
    return formatNum(total)
  })
  return means
}

// 季度分隔线
const quarterStartMonths = [4, 7, 10, 1]
function getQuarterCellClass({ column }: { column: any }) {
  const month = column.property
  if (!month || month === 'storeName' || month === 'subtotal') return ''
  const monthNum = parseInt(month.split('-')[1])
  return quarterStartMonths.includes(monthNum) ? 'quarter-start' : ''
}
function getQuarterHeaderClass({ column }: { column: any }) {
  const month = column.property
  if (!month || month === 'storeName' || month === 'subtotal') return ''
  const monthNum = parseInt(month.split('-')[1])
  return quarterStartMonths.includes(monthNum) ? 'quarter-start' : ''
}

// 门店行底色（每店一色，参照支付管理服务商底色模式）
const storeColorCount = 11
function getMatrixRowClass({ row }: { row: any }) {
  if (!row.storeName) return ''
  const idx = detailStores.value.indexOf(row.storeName)
  return idx >= 0 ? `store-row-${idx % storeColorCount}` : ''
}

// 门店标识色条颜色（与行底色关联，取行hover色=深一档）
function getStoreIndicatorColor(storeName: string): string {
  const idx = detailStores.value.indexOf(storeName)
  if (idx < 0) return 'var(--border-base)'
  return `var(--store-row-${idx % storeColorCount}-hover)`
}

// 高金额标红加粗（≥2000）
function isHighAmount(value: number | string): boolean {
  return Number(value) >= 2000
}

// 生成下个财年
function handleGenerateNextYear() {
  const nextYear = selectedFiscalYear.value + 1
  ElMessageBox.confirm(
    `将克隆 ${selectedFiscalYear.value} 财年的全部明细到 ${nextYear} 财年，之后可逐条修改差异部分。是否继续？`,
    '生成下个财年',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    const ok = await generateNextFiscalYear(selectedFiscalYear.value)
    if (ok) {
      ElMessage.success(`已生成 ${nextYear} 财年预算`)
      selectedFiscalYear.value = nextYear
    } else {
      ElMessage.warning(`${nextYear} 财年已存在数据，无法重复生成`)
    }
  }).catch(() => {})
}

// === Tab 2: 明细视图 ===
const filterStore = ref('')
const expandedStores = ref<string[]>([])

const groupedDetails = computed(() => {
  const yearDetails = budgetDetails.value.filter(d => d.fiscalYear === selectedFiscalYear.value)
  const stores = [...new Set(yearDetails.map(d => d.storeName))]
    .filter(s => !filterStore.value || s === filterStore.value)
  return stores.map(store => {
    const items = yearDetails.filter(d => d.storeName === store)
    const monthlySubtotal = items.reduce((s, d) => s + d.monthlyFee, 0)
    const annualSubtotal = items.reduce((s, d) => s + d.annualFee, 0)
    return { storeName: store, items, monthlySubtotal, annualSubtotal }
  })
})

// 默认展开前3个门店
watch(() => filterStore.value, () => {
  expandedStores.value = groupedDetails.value.slice(0, 3).map(g => g.storeName)
}, { immediate: true })

// 明细CRUD弹窗
const detailDialogVisible = ref(false)
const detailDialogTitle = ref('')
const saving = ref(false)
const detailFormRef = ref()
const detailForm = reactive({
  id: 0, fiscalYear: 2026, storeName: '', carrier: '', feeType: '',
  monthlyFee: 0, annualFee: 0, feeRange: '',
  broadbandType: '', paymentMethod: '', remark: '',
})
const detailRules = {
  storeName: [{ required: true, message: '请选择门店', trigger: 'change' }],
  carrier: [{ required: true, message: '请选择运营商', trigger: 'change' }],
  feeType: [{ required: true, message: '请选择费用类型', trigger: 'change' }],
  monthlyFee: [{ required: true, message: '请输入月费', trigger: 'blur' }],
}

function handleAddDetail() {
  detailDialogTitle.value = '新增明细'
  Object.assign(detailForm, {
    id: 0, fiscalYear: selectedFiscalYear.value, storeName: '', carrier: '', feeType: '',
    monthlyFee: 0, annualFee: 0, feeRange: '',
    broadbandType: '', paymentMethod: '', remark: '',
  })
  detailDialogVisible.value = true
}

function handleEditDetail(row: BudgetDetail) {
  detailDialogTitle.value = '编辑明细'
  Object.assign(detailForm, row)
  detailDialogVisible.value = true
}

function handleSaveDetail() {
  detailFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (detailForm.id === 0) {
        await addDetail({
          fiscalYear: detailForm.fiscalYear,
          storeName: detailForm.storeName, carrier: detailForm.carrier,
          feeType: detailForm.feeType, monthlyFee: detailForm.monthlyFee,
          annualFee: detailForm.annualFee, feeRange: detailForm.feeRange,
          broadbandType: detailForm.broadbandType, paymentMethod: detailForm.paymentMethod,
          remark: detailForm.remark,
        })
        ElMessage.success('新增成功')
      } else {
        await updateDetail(detailForm.id, { ...detailForm })
        ElMessage.success('编辑成功')
      }
      detailDialogVisible.value = false
    } catch {
      // 错误已由 composable 处理
    } finally {
      saving.value = false
    }
  })
}

function handleDeleteDetail(row: BudgetDetail) {
  ElMessageBox.confirm(`确定删除该明细项？(${row.storeName}-${row.carrier}-${row.feeType})`, '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
  }).then(async () => {
    await deleteDetail(row.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

// 复制明细：打开编辑弹窗，预填被复制项数据（ID=0）
function handleDuplicateDetail(row: BudgetDetail) {
  detailDialogTitle.value = `复制明细（基于：${row.storeName}-${row.carrier}-${row.feeType}）`
  Object.assign(detailForm, {
    ...row,
    id: 0,
    fiscalYear: selectedFiscalYear.value,
  })
  detailDialogVisible.value = true
}

// 费用范围日期选择器双向绑定（字符串 ↔ 日期数组）
const feeRangeDate = computed({
  get() {
    if (!detailForm.feeRange) return null
    const parts = detailForm.feeRange.split('~')
    const p0 = parts[0]
    const p1 = parts[1]
    if (p0 && p1) return [p0.trim(), p1.trim()]
    return null
  },
  set(val: string[] | null) {
    detailForm.feeRange = val && val.length === 2 ? `${val[0]}~${val[1]}` : ''
  },
})

// === Tab 3: 执行对比 ===
const execFilterMonth = ref('')
const execFilterStore = ref('')
const execFilterCarrier = ref('')

const execMonths = computed(() => [...new Set(budgetExecutions.value.map(e => e.month))].sort().reverse())

const filteredExecutions = computed(() => {
  return budgetExecutions.value.filter(e => {
    if (e.fiscalYear !== selectedFiscalYear.value) return false
    if (execFilterMonth.value && e.month !== execFilterMonth.value) return false
    if (execFilterStore.value && e.storeName !== execFilterStore.value) return false
    if (execFilterCarrier.value && e.carrier !== execFilterCarrier.value) return false
    return true
  }).sort((a, b) => b.month.localeCompare(a.month))
})

const execTotalBudget = computed(() => filteredExecutions.value.reduce((s, e) => s + e.budgetAmount, 0))
const execTotalActual = computed(() => filteredExecutions.value.reduce((s, e) => s + e.actualAmount, 0))
const execRate = computed(() => execTotalBudget.value > 0 ? ((execTotalActual.value / execTotalBudget.value) * 100).toFixed(1) : '0.0')
const execOverCount = computed(() => filteredExecutions.value.filter(e => e.actualAmount > e.budgetAmount).length)

function getExecRate(row: BudgetExecution): number {
  if (row.budgetAmount === 0) return 0
  return Math.min(100, Math.round((row.actualAmount / row.budgetAmount) * 100))
}

/** 真实执行率（不截断100%），用于进度条文字和tooltip显示 */
function getRealExecRate(row: BudgetExecution): string {
  if (row.budgetAmount === 0) return '0.0'
  return ((row.actualAmount / row.budgetAmount) * 100).toFixed(1)
}

function getProgressColor(row: BudgetExecution): string {
  const rate = row.actualAmount / row.budgetAmount
  if (rate > 1) return 'var(--color-danger)'
  if (rate > 0.9) return 'var(--color-warning)'
  return 'var(--color-success)'
}

// === 工具函数 ===
function formatNum(val: number | string | undefined): string {
  if (val === undefined || val === null || val === '') return '0'
  const n = Number(val)
  if (isNaN(n)) return String(val)
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// === 导出Excel ===
const exporting = ref(false)

async function handleExportExcel() {
  exporting.value = true
  try {
    const fy = selectedFiscalYear.value
    const wb = new ExcelJS.Workbook()
    const months = currentMonths.value

    // Sheet1: 汇总矩阵
    const ws1 = wb.addWorksheet('汇总视图', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
    })
    const headers = ['门店', ...months.map(m => getMonthLabel(m)), '财年小计']
    const headerRow = ws1.addRow(headers)
    headerRow.font = { bold: true }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6EC' } }

    for (const row of matrixData.value) {
      ws1.addRow([row.storeName, ...months.map(m => row[m]), row.subtotal])
    }
    const summaryResult = getSummaryMatrix(fy)
    const totalExcelRow = ws1.addRow(['合计', ...months.map(m => summaryResult.totalRow[m]), summaryResult.totalRow.subtotal])
    totalExcelRow.font = { bold: true }
    totalExcelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }

    ws1.getColumn(1).width = 20
    for (let i = 2; i <= months.length + 2; i++) ws1.getColumn(i).width = 12
    for (let r = 2; r <= ws1.rowCount; r++) {
      for (let c = 2; c <= months.length + 2; c++) {
        ws1.getRow(r).getCell(c).numFmt = '#,##0.00'
      }
    }

    // Sheet2: 明细清单
    const ws2 = wb.addWorksheet('明细清单')
    const detailHeaders = ['门店', '运营商', '费用类型', '月费(元)', '年费(元)', '费用范围', '宽带类型', '缴费方式', '备注']
    const detailHeaderRow = ws2.addRow(detailHeaders)
    detailHeaderRow.font = { bold: true }
    detailHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF6EC' } }

    const yearDetails = budgetDetails.value.filter(d => d.fiscalYear === fy)
    for (const d of yearDetails) {
      ws2.addRow([d.storeName, d.carrier, d.feeType, d.monthlyFee, d.annualFee, formatFeeRange(d.feeRange), d.broadbandType, d.paymentMethod, d.remark])
    }
    ws2.getColumn(1).width = 18; ws2.getColumn(2).width = 10; ws2.getColumn(3).width = 12
    ws2.getColumn(4).width = 12; ws2.getColumn(5).width = 12; ws2.getColumn(6).width = 20
    ws2.getColumn(7).width = 16; ws2.getColumn(8).width = 12; ws2.getColumn(9).width = 40
    for (let r = 2; r <= ws2.rowCount; r++) {
      ws2.getRow(r).getCell(4).numFmt = '#,##0.00'
      ws2.getRow(r).getCell(5).numFmt = '#,##0.00'
    }

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `预算汇总_${fy}财年.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e) {
    console.error(e)
    ElMessage.error('导出失败')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.budget-tabs { margin-top: 4px; }
.tab-toolbar {
  display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;
}
.tab-hint { font-size: var(--font-size-mini); color: var(--text-secondary); }

.matrix-table { width: 100%; }
.matrix-table :deep(.el-table__cell) { padding: 12px 8px; }

.store-cell { display: flex; align-items: center; gap: 8px; }
.store-indicator {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  flex-shrink: 0;
  background: var(--indicator-color, var(--border-base));
}

/* 表头：居中+加粗+放大 */
.matrix-table :deep(.el-table__header th .cell) {
  font-size: var(--font-size-body);
  font-weight: 700;
}

/* tooltip 费用构成 */
.amount-cell { cursor: default; }
.fee-breakdown { min-width: 220px; max-width: 320px; }
.breakdown-header {
  font-weight: 600;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255,255,255,0.2);
}
.breakdown-item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 2px 0;
}
.breakdown-fee { font-weight: 500; }
.breakdown-total {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-top: 4px;
  margin-top: 4px;
  border-top: 1px solid rgba(255,255,255,0.2);
  font-weight: 600;
}
.breakdown-empty { color: rgba(255,255,255,0.6); font-style: italic; }

.subtotal-text { font-weight: 600; color: var(--color-primary); }
.amount-high { color: var(--color-danger); font-weight: 600; }

/* 季度分隔 */
.matrix-table :deep(.quarter-start) { border-left: 1px solid var(--border-light) !important; }

/* 门店行底色（每店一色，参照支付管理服务商底色模式） */
.matrix-table :deep(.store-row-0 > td) { background: var(--store-row-0-bg) !important; }
.matrix-table :deep(.store-row-1 > td) { background: var(--store-row-1-bg) !important; }
.matrix-table :deep(.store-row-2 > td) { background: var(--store-row-2-bg) !important; }
.matrix-table :deep(.store-row-3 > td) { background: var(--store-row-3-bg) !important; }
.matrix-table :deep(.store-row-4 > td) { background: var(--store-row-4-bg) !important; }
.matrix-table :deep(.store-row-5 > td) { background: var(--store-row-5-bg) !important; }
.matrix-table :deep(.store-row-6 > td) { background: var(--store-row-6-bg) !important; }
.matrix-table :deep(.store-row-7 > td) { background: var(--store-row-7-bg) !important; }
.matrix-table :deep(.store-row-8 > td) { background: var(--store-row-8-bg) !important; }
.matrix-table :deep(.store-row-9 > td) { background: var(--store-row-9-bg) !important; }
.matrix-table :deep(.store-row-10 > td) { background: var(--store-row-10-bg) !important; }
.matrix-table :deep(.store-row-0:hover > td) { background: var(--store-row-0-hover) !important; }
.matrix-table :deep(.store-row-1:hover > td) { background: var(--store-row-1-hover) !important; }
.matrix-table :deep(.store-row-2:hover > td) { background: var(--store-row-2-hover) !important; }
.matrix-table :deep(.store-row-3:hover > td) { background: var(--store-row-3-hover) !important; }
.matrix-table :deep(.store-row-4:hover > td) { background: var(--store-row-4-hover) !important; }
.matrix-table :deep(.store-row-5:hover > td) { background: var(--store-row-5-hover) !important; }
.matrix-table :deep(.store-row-6:hover > td) { background: var(--store-row-6-hover) !important; }
.matrix-table :deep(.store-row-7:hover > td) { background: var(--store-row-7-hover) !important; }
.matrix-table :deep(.store-row-8:hover > td) { background: var(--store-row-8-hover) !important; }
.matrix-table :deep(.store-row-9:hover > td) { background: var(--store-row-9-hover) !important; }
.matrix-table :deep(.store-row-10:hover > td) { background: var(--store-row-10-hover) !important; }

/* 合计行 */
.matrix-table :deep(.el-table__footer-wrapper) .el-table__cell {
  font-weight: 700; background: var(--bg-page) !important;
  border-top: 2px solid var(--color-primary-border) !important;
  color: var(--text-primary);
}

.detail-collapse { border: none; }
.detail-collapse :deep(.el-collapse-item__header) { font-size: var(--font-size-body); font-weight: 600; }
.store-title { margin-right: 16px; }
.store-subtotal { font-size: var(--font-size-small); color: var(--text-secondary); font-weight: normal; }
.detail-table { margin: 8px 0 4px; }

.exec-overview { margin-bottom: 16px; }
.exec-stat {
  display: flex; flex-direction: column; gap: 4px;
  padding: 12px 16px; background: var(--bg-page); border-radius: var(--radius-card);
}
.exec-label { font-size: var(--font-size-mini); color: var(--text-secondary); }
.exec-val { font-size: var(--font-size-title); font-weight: 600; color: var(--text-primary); }
.exec-val.over { color: var(--color-danger); }

.execution-cell { display: flex; align-items: center; gap: 8px; }
.amount-over { color: var(--color-danger); font-weight: 600; }

/* 执行对比 tooltip */
.exec-breakdown { min-width: 220px; max-width: 320px; }
.exec-breakdown .text-over { color: #F89898; }
</style>
