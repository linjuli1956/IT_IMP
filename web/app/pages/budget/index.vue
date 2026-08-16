<template>
  <div class="page-container">
    <PageHeader
      title="预算管理"
      subtitle="门店预算矩阵与执行对比"
      description="汇总视图：门店×月份预算矩阵，按费用范围逐月计算，≥2000元高金额标红，按季度中性分隔。鼠标悬停查看费用构成，支持导出Excel（汇总+明细2个Sheet）。明细视图：按门店分组展开，查看运营商×费用类型的月费/年费/费用范围/缴费方式。执行对比：预算vs实际支出，进度条超100%标红。支持生成下个财年、新增/复制明细。"
    >
      <template #actions>
        <el-button plain @click="handleDownloadTemplate">
          <el-icon><Download /></el-icon>
          下载模板
        </el-button>
        <el-button v-if="canEdit" plain @click="openImportDialog">
          <el-icon><Upload /></el-icon>
          导入数据
        </el-button>
        <el-button v-if="canEdit" type="primary" @click="handleAddDetail">
          <el-icon><Plus /></el-icon>
          新增明细
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览卡片（label 带财年标识，切换财年一目了然） -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Wallet" :color="budgetVars.budgetColor" :bg="budgetVars.budgetBg" :value="'¥ ' + totalAnnualBudget.toLocaleString()" :label="selectedFiscalYear + '财年预算总额'" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Money" :color="budgetVars.monthlyColor" :bg="budgetVars.monthlyBg" :value="'¥ ' + totalMonthlyBudget.toLocaleString()" :label="selectedFiscalYear + '财年月度预算'" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="DataLine" :color="budgetVars.storeColor" :bg="budgetVars.storeBg" :value="detailStores.length + ' 个'" :label="selectedFiscalYear + '财年门店数'" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="budgetVars.warnColor" :bg="budgetVars.warnBg" :value="overBudgetCount + ' 项'" :label="selectedFiscalYear + '财年超支预警'" />
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
            <el-button v-if="canEdit" type="warning" plain @click="handleGenerateNextYear">
              <el-icon><CopyDocument /></el-icon>
              生成下个财年
            </el-button>
            <el-button v-if="canEdit" type="danger" plain @click="handleDeleteFiscalYear">
              <el-icon><Delete /></el-icon>
              删除财年
            </el-button>
            <el-button type="success" plain @click="handleExportExcel" :loading="exporting">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
            <span class="tab-hint">{{ fiscalYearRangeText }}</span>
          </div>
          <el-table v-if="matrixData.length > 0" :data="matrixData" border show-summary :summary-method="getSummary" :cell-class-name="getQuarterCellClass" :header-cell-class-name="getQuarterHeaderClass" class="matrix-table">
            <el-table-column prop="storeName" label="门店" fixed width="180" header-align="center" show-overflow-tooltip />
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
          <EmptyState v-else :description="`${selectedFiscalYear}财年暂无预算数据，可切换财年或导入数据`" />
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
          <el-collapse v-if="groupedDetails.length > 0" v-model="expandedStores" class="detail-collapse">
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
                <el-table-column v-if="canEdit" label="操作" width="150" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" text type="primary" @click.stop="handleDuplicateDetail(row as BudgetDetail)">复制</el-button>
                    <el-button size="small" text type="primary" @click.stop="handleEditDetail(row as BudgetDetail)">编辑</el-button>
                    <el-button size="small" text type="danger" @click.stop="handleDeleteDetail(row as BudgetDetail)">删除</el-button>
                  </template>
                </el-table-column>
              </el-table>
            </el-collapse-item>
          </el-collapse>
          <EmptyState v-else description="暂无符合条件的预算明细，可调整筛选或新增明细" />
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
          <el-table v-if="filteredExecutions.length > 0" :data="filteredExecutions" border>
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
          <EmptyState v-else description="暂无执行对比数据，可调整筛选条件" />
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

    <!-- 预算 Excel 导入弹窗 -->
    <el-dialog v-model="importDialogVisible" title="导入预算明细" width="580px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon class="import-alert">
        <template #title>导入说明</template>
        <div class="import-tips">
          <p>1. 先点击「下载模板」获取标准模板，填写后保存为 xlsx 文件再上传。</p>
          <p>2. 必填：财年、门店、运营商、费用类型；月费/年费留空按 0 处理。</p>
          <p>3. 同一 财年+门店+运营商+费用类型 已存在时会自动跳过该行。</p>
          <p>4. 存在填写错误的行时整批不导入，请根据错误提示修正后重新上传。</p>
        </div>
      </el-alert>

      <DragUpload
        ref="importUploadRef"
        accept=".xlsx,.xls"
        :max-count="1"
        hint-text="将 xlsx 文件拖拽到此处，或点击选择"
        sub-hint="支持 .XLSX / .XLS 格式，单文件，最大 5MB"
        @files-change="handleImportFilesChange"
      />

      <el-form label-width="110px" class="import-form">
        <el-form-item label="默认费用范围">
          <div class="import-range-field">
            <el-date-picker
              v-model="importDefaultFeeRange"
              type="monthrange"
              value-format="YYYY-MM"
              start-placeholder="开始月份"
              end-placeholder="结束月份"
              clearable
              style="width: 320px"
            />
            <div class="form-tip">选填：模板中“费用范围”留空的行导入时自动填为该范围；模板已填写具体范围的以模板为准。</div>
          </div>
        </el-form-item>
      </el-form>

      <el-alert v-if="importResult" :type="importResult.type" :closable="false" show-icon class="import-result">
        <template #title>{{ importResult.title }}</template>
        <div v-if="importResult.errors && importResult.errors.length > 0" class="import-errors">
          <el-table :data="importResult.errors" size="small" border max-height="220">
            <el-table-column prop="row" label="Excel 行号" width="110" align="center" />
            <el-table-column prop="message" label="原因" min-width="200" />
          </el-table>
        </div>
      </el-alert>

      <template #footer>
        <el-button @click="closeImportDialog">关闭</el-button>
        <el-button type="primary" :loading="importing" :disabled="!importFile" @click="handleImportConfirm">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Wallet, Money, DataLine, WarningFilled, CopyDocument, Download, Upload, Delete } from '@element-plus/icons-vue'
import ExcelJS from 'exceljs'
import DragUpload from '~/components/invoice/DragUpload.vue'
import {
  useBudgetData, budgetCarriers, budgetFeeTypes,
  type BudgetDetail, type BudgetExecution, type BudgetImportErrorItem,
} from '~/composables/useBudgetData'
import { getFiscalYearMonths, getMonthLabel, formatFeeRange } from '~/utils/fiscal'
import { getApiErrorMessage } from '~/composables/useApi'
import { useStoreData } from '~/composables/useStoreData'
import { useSettingsData } from '~/composables/useSettingsData'

const {
  budgetDetails, budgetExecutions, loading, fiscalYears,
  fetchDetails, fetchExecutions,
  getDetailStores, getSummaryMatrix, getMonthBreakdown, generateNextFiscalYear,
  addDetail, updateDetail, deleteDetail, deleteFiscalYear, downloadBudgetTemplate, importBudget,
} = useBudgetData()
const { storeOptions } = useStoreData()
const { fiscalYearStartMonth } = useSettingsData()

// 页面加载时获取预算明细和执行对比数据
onMounted(async () => {
  // 操作按钮（导入/新增/生成/删除）仅管理员与操作员可见，查看者只读
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch {
      canEdit.value = false
    }
  }
  await fetchDetails()
  await fetchExecutions()
})

const activeTab = ref('summary')
const selectedFiscalYear = ref(2026)
/** 是否有编辑权限（管理员/操作员），查看者只读 */
const canEdit = ref(false)

// 当前财年的月份列表（按系统设置的财年起始月生成）
const currentMonths = computed(() => getFiscalYearMonths(selectedFiscalYear.value, fiscalYearStartMonth.value))

// 财年范围提示文案（如 "2026财年 = 2026年4月 ~ 2027年3月"）
const fiscalYearRangeText = computed(() => {
  const y = selectedFiscalYear.value
  const m = fiscalYearStartMonth.value
  const endMonth = m === 1 ? 12 : m - 1
  const endYear = m === 1 ? y : y + 1
  return `${y}财年 = ${y}年${m}月 ~ ${endYear}年${endMonth}月，按费用范围逐月计算`
})
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

// 季度分隔线（按系统设置的财年起始月动态计算：起始月、+3、+6、+9，跨年按 12 取模）
const quarterStartMonths = computed(() => {
  const m = fiscalYearStartMonth.value
  return [m, (m + 3 - 1) % 12 + 1, (m + 6 - 1) % 12 + 1, (m + 9 - 1) % 12 + 1]
})
function getQuarterCellClass({ column }: { column: any }) {
  const month = column.property
  if (!month || month === 'storeName' || month === 'subtotal') return ''
  const monthNum = parseInt(month.split('-')[1])
  return quarterStartMonths.value.includes(monthNum) ? 'quarter-start' : ''
}
function getQuarterHeaderClass({ column }: { column: any }) {
  const month = column.property
  if (!month || month === 'storeName' || month === 'subtotal') return ''
  const monthNum = parseInt(month.split('-')[1])
  return quarterStartMonths.value.includes(monthNum) ? 'quarter-start' : ''
}

// 高金额标红加粗（≥2000）
function isHighAmount(value: number | string): boolean {
  return Number(value) >= 2000
}

// 生成下个财年
function handleGenerateNextYear() {
  if (!canEdit.value) return
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

// 删除整个财年（危险操作，需输入财年数字确认）
async function handleDeleteFiscalYear() {
  if (!canEdit.value) return
  const year = selectedFiscalYear.value
  try {
    const { value } = await ElMessageBox.prompt(
      `将删除 ${year} 财年的全部预算明细与执行对比数据（共涉及 budget_details / budget_executions），此操作不可恢复。\n请输入财年数字「${year}」以确认：`,
      '删除财年',
      {
        type: 'warning',
        confirmButtonText: '确认删除（不可逆）',
        cancelButtonText: '取消',
        inputPlaceholder: `请输入 ${year}`,
        inputValidator: (val) => String(val).trim() === String(year) || '输入的财年不匹配，请重新输入',
      },
    )
    if (String(value).trim() !== String(year)) return
    const { detailCount, executionCount } = await deleteFiscalYear(year)
    ElMessage.success(`已删除 ${year} 财年：明细 ${detailCount} 条、执行对比 ${executionCount} 条`)
    // 自动切换到剩余财年（取最大），避免停留在已删除财年显示空数据
    const remaining = fiscalYears.value.filter(y => y !== year)
    if (remaining.length > 0) {
      selectedFiscalYear.value = Math.max(...remaining)
    }
  } catch {
    // 取消或校验失败
  }
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
  if (!canEdit.value) return
  detailDialogTitle.value = '新增明细'
  Object.assign(detailForm, {
    id: 0, fiscalYear: selectedFiscalYear.value, storeName: '', carrier: '', feeType: '',
    monthlyFee: 0, annualFee: 0, feeRange: '',
    broadbandType: '', paymentMethod: '', remark: '',
  })
  detailDialogVisible.value = true
}

function handleEditDetail(row: BudgetDetail) {
  if (!canEdit.value) return
  detailDialogTitle.value = '编辑明细'
  Object.assign(detailForm, row)
  detailDialogVisible.value = true
}

function handleSaveDetail() {
  detailFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    if (!canEdit.value) return
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
  if (!canEdit.value) return
  ElMessageBox.confirm(`确定删除该明细项？(${row.storeName}-${row.carrier}-${row.feeType})`, '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
  }).then(async () => {
    await deleteDetail(row.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

// === 预算 Excel 导入 ===
const importDialogVisible = ref(false)
const importing = ref(false)
const importFile = ref<File | null>(null)
const importDefaultFeeRange = ref<string[] | null>(null)
const importUploadRef = ref()
const importResult = ref<{
  type: 'success' | 'error'
  title: string
  errors: BudgetImportErrorItem[]
} | null>(null)

function openImportDialog() {
  if (!canEdit.value) return
  importDialogVisible.value = true
  importResult.value = null
  importFile.value = null
  importDefaultFeeRange.value = null
}

function closeImportDialog() {
  importDialogVisible.value = false
  importResult.value = null
  importFile.value = null
  importDefaultFeeRange.value = null
  importUploadRef.value?.clear()
}

async function handleDownloadTemplate() {
  try {
    await downloadBudgetTemplate()
    ElMessage.success('模板已下载，请填写后保存为 xlsx 再导入')
  } catch (e) {
    console.error(e)
    ElMessage.error('模板下载失败')
  }
}

function handleImportFilesChange(files: { raw?: File }[]) {
  importFile.value = files[0]?.raw ?? null
  importResult.value = null
}

async function handleImportConfirm() {
  if (!importFile.value) return
  if (!canEdit.value) return
  importing.value = true
  importResult.value = null
  try {
    const defaultFeeRange = importDefaultFeeRange.value
      ? importDefaultFeeRange.value.join('~')
      : ''
    const { count, skipped } = await importBudget(importFile.value, defaultFeeRange)
    importResult.value = {
      type: 'success',
      title: skipped > 0 ? `导入成功 ${count} 条，跳过重复 ${skipped} 条` : `导入成功 ${count} 条`,
      errors: [],
    }
    importFile.value = null
    importUploadRef.value?.clear()
  } catch (error: any) {
    const errors: BudgetImportErrorItem[] = error?.response?._data?.errors || error?.data?.errors || []
    importResult.value = {
      type: 'error',
      title: getApiErrorMessage(error) || '导入失败',
      errors,
    }
  } finally {
    importing.value = false
  }
}

// 复制明细：打开编辑弹窗，预填被复制项数据（ID=0）
function handleDuplicateDetail(row: BudgetDetail) {
  if (!canEdit.value) return
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
.exec-breakdown .text-over { color: var(--color-danger); }

/* 预算 Excel 导入弹窗 */
.import-alert { margin-bottom: var(--spacing-card); }
.import-tips { font-size: var(--font-size-mini); line-height: 1.8; }
.import-form { margin-top: var(--spacing-card); }
.import-range-field { display: flex; flex-direction: column; gap: 6px; }
.form-tip { font-size: var(--font-size-mini); color: var(--text-secondary); }
.import-result { margin-top: var(--spacing-card); }
.import-errors { margin-top: var(--spacing-sm); }
</style>
