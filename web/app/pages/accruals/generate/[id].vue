<template>
  <div class="page-container">
    <PageHeader :title="`生成计提表 ${batch ? batchNo : ''}`" subtitle="按明细表/发票/分摊方案生成">
      <template #actions>
        <el-button @click="navigateTo(`/invoices/batches/${batchId}`)">返回批次详情</el-button>
        <el-button v-if="canWrite" type="primary" :disabled="!batch || generating" :loading="generating" @click="handleGenerate">
          确认生成计提表
        </el-button>
      </template>
    </PageHeader>

    <template v-if="batch">
      <!-- 批次信息 -->
      <div class="card batch-info-card">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="批次号">{{ batchNo }}</el-descriptions-item>
          <el-descriptions-item label="运营商">{{ batch.carrier }}</el-descriptions-item>
          <el-descriptions-item label="费用月">{{ batch.feeMonth }}</el-descriptions-item>
          <el-descriptions-item label="发票数量">{{ batch.invoiceCount }} 张</el-descriptions-item>
          <el-descriptions-item label="合计金额">
            <span class="amount-highlight">¥ {{ batch.totalAmount.toFixed(2) }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 计提方式选择 -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">计提方式</span>
        </div>

        <!-- 计提月份：默认费用月的下个月；报销说明仍按费用月生成 -->
        <el-form :inline="true" class="accrual-month-form">
          <el-form-item label="计提月份">
            <el-date-picker
              v-model="accrualMonth"
              type="month"
              value-format="YYYY-MM"
              :clearable="false"
              placeholder="选择计提月份"
              style="width: 160px"
            />
            <span class="month-hint">默认费用月的下个月（费用月 {{ batch.feeMonth }}）；报销说明仍按费用月生成</span>
          </el-form-item>
        </el-form>

        <el-radio-group v-model="generateMethod" @change="onMethodChange">
          <el-radio-button value="detail">按明细表（电信号码匹配）</el-radio-button>
          <el-radio-button value="invoice">按发票均摊</el-radio-button>
          <el-radio-button value="allocation">按费用分摊方案</el-radio-button>
        </el-radio-group>

        <!-- 明细表选择（detail/invoice 模式） -->
        <template v-if="generateMethod !== 'allocation'">
          <el-form :inline="true" style="margin-top: var(--spacing-card);">
            <el-form-item label="选择明细表">
              <el-select
                v-model="selectedDetailId"
                placeholder="选择明细表"
                style="width: 300px"
                @change="onDetailChange"
              >
                <el-option label="不关联明细表（按发票方式生成）" :value="0" />
                <el-option
                  v-for="d in availableDetailTables"
                  :key="d.id"
                  :label="`${d.fileName}（${d.carrier} ${d.feeMonth}，${d.totalNumbers}个号码）`"
                  :value="d.id"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-alert
            v-if="useDetailMode && !selectedDetailTable"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: var(--spacing-btn-gap);"
          >
            <template #title>未选择有效的明细表</template>
            <div>按明细表方式生成需要选择明细表，或选择"不关联明细表"改为按发票方式生成。</div>
          </el-alert>
          <div v-if="selectedDetailTable" class="detail-info">
            <span>文件名：{{ selectedDetailTable.fileName }}</span>
            <span class="divider">|</span>
            <span>共 {{ selectedDetailTable.sheetCount }} 个Sheet，{{ selectedDetailTable.totalNumbers }} 个号码</span>
          </div>
        </template>

        <!-- 费用分摊方案选择（allocation 模式） -->
        <template v-else>
          <el-form :inline="true" style="margin-top: var(--spacing-card);">
            <el-form-item label="选择方案">
              <el-select
                v-model="selectedSchemeId"
                placeholder="选择费用分摊方案"
                style="width: 400px"
                @change="onSchemeChange"
              >
                <el-option
                  v-for="s in availableSchemes"
                  :key="s.id"
                  :label="`${s.name}${s.carrier ? '（' + s.carrier + '）' : '（通用）'}`"
                  :value="s.id"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <el-alert
            v-if="availableSchemes.length === 0"
            type="warning"
            :closable="false"
            show-icon
            style="margin-top: var(--spacing-btn-gap);"
          >
            <template #title>暂无可用的费用分摊方案</template>
            <div>请先在"基础配置 > 费用分摊方案"中创建方案。</div>
          </el-alert>
          <div v-if="selectedScheme" class="detail-info">
            <span>方案：{{ selectedScheme.name }}</span>
            <span class="divider">|</span>
            <span>{{ (selectedScheme.items || []).length }} 个费用项</span>
            <span class="divider">|</span>
            <span>运营商：{{ selectedScheme.carrier || '通用' }}</span>
          </div>
        </template>
      </div>

      <!-- 发票 → 计提明细行（仅按发票模式）：默认按顺序 1:1，可改成 1:N；改映射后下方预览实时更新 -->
      <div v-if="generateMethod === 'invoice' && invoiceMappingGroups.length > 0" class="card">
        <div class="section-header">
          <span class="section-title">发票 → 计提明细行</span>
          <el-tag type="info" size="small">默认按顺序 1:1，可更改；一张发票可对应多行（平均分摊，可在预览中微调）</el-tag>
        </div>
        <div v-for="group in invoiceMappingGroups" :key="group.store" class="invoice-map-group">
          <div class="invoice-map-group-header">
            <span class="invoice-map-store">{{ group.store }}</span>
            <el-button size="small" text type="primary" @click="resetInvoiceMapping(group.store)">按顺序重置</el-button>
          </div>
          <el-table :data="group.invoices" border size="small" style="width: 100%">
            <el-table-column label="发票号码" width="150">
              <template #default="{ row }">{{ row.invoiceNumber || '—' }}</template>
            </el-table-column>
            <el-table-column label="开票日期" width="110" align="center">
              <template #default="{ row }">{{ row.invoiceDate || '—' }}</template>
            </el-table-column>
            <el-table-column label="发票金额" width="120" align="right">
              <template #default="{ row }">¥ {{ Number(row.amount).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="对应计提明细行（可多选）" min-width="260">
              <template #default="{ row }">
                <el-select
                  :model-value="invoiceMapping[group.store]?.[row.id] ?? []"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  placeholder="选择明细行"
                  style="width: 100%"
                  @update:model-value="(v) => setInvoiceRowMapping(group.store, row.id, v as number[])"
                >
                  <el-option
                    v-for="(item, idx) in group.templateItems"
                    :key="idx"
                    :label="`${idx + 1}. ${item.name}`"
                    :value="idx"
                  />
                </el-select>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <!-- 按门店分组的计提预览 -->
      <div v-for="(group, idx) in previewGroups" :key="idx" class="card">
        <div class="section-header">
          <span class="section-title">{{ group.store }}</span>
          <div class="group-actions">
            <el-select
              v-if="generateMethod !== 'allocation'"
              v-model="group.selectedTemplateId"
              size="small"
              placeholder="选择模板"
              style="width: 200px"
              @change="updatePreviewGroup(group)"
            >
              <el-option
                v-for="t in getAvailableTemplates(group.store)"
                :key="t.id"
                :label="`${t.carrier} - ${t.store}`"
                :value="t.id"
              />
            </el-select>
            <el-tag type="info" size="small">发票金额：¥ {{ (generateMethod === 'allocation' ? batchTotalInvoice : group.invoiceAmount).toFixed(2) }}</el-tag>
            <el-tag type="primary" size="small">小计：¥ {{ group.subtotal.toFixed(2) }}</el-tag>
            <el-tag
              v-if="generateMethod === 'invoice' && hasInvoiceMapping"
              :type="Math.abs(group.subtotal - group.invoiceAmount) > 0.005 ? 'danger' : 'success'"
              size="small"
            >
              {{ Math.abs(group.subtotal - group.invoiceAmount) > 0.005
                ? `分摊差额：¥ ${(group.subtotal - group.invoiceAmount).toFixed(2)}`
                : '分摊与发票一致' }}
            </el-tag>
            <el-tag v-if="generateMethod === 'allocation'" :type="(groupRemaining[idx] ?? 0) > 0.01 ? 'danger' : 'success'" size="small">
              待分摊：¥ {{ (groupRemaining[idx] ?? 0).toFixed(2) }}
            </el-tag>
          </div>
        </div>

        <el-table :data="group.rows" border stripe size="small" style="width: 100%">
          <el-table-column label="序号" width="60" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="承担部门" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="d in row.dept" :key="d" size="small" type="info" class="dept-tag">{{ d }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="generateMethod === 'allocation'" label="费用类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.feeType" size="small" type="warning">{{ row.feeType }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称/号码" min-width="160" />
          <el-table-column label="费用" width="160" align="right">
            <template #default="{ row }">
              <el-input-number
                v-if="row.isInvoiceMapped"
                :model-value="invoiceRowOverrides[row._store]?.[row._rowIndex] ?? row.amount"
                size="small"
                :min="0"
                :precision="2"
                :step="0.01"
                controls-position="right"
                style="width: 130px"
                @change="(v) => onInvoiceRowAmountChange(row._store, row._rowIndex, v as number | undefined)"
              />
              <el-input-number
                v-else-if="row.isManual"
                v-model="manualAdjustments[row.manualKey]"
                size="small"
                :min="0"
                :precision="2"
                controls-position="right"
                style="width: 120px"
                @change="onManualAmountChange"
              />
              <span v-else class="amount-text">¥ {{ row.amount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="100" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="getSourceType(row.source)">{{ getSourceText(row.source) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        </el-table>

      </div>

      <!-- 汇总报销说明（合并） -->
      <div v-if="previewGroups.length > 0" class="card consolidated-card">
        <ReimbursementText
          :text="consolidatedReimbursementText"
          label="汇总报销说明（合并）"
        />
      </div>

      <!-- 无匹配模板的门店提示（仅 detail/invoice 模式） -->
      <div v-if="generateMethod !== 'allocation' && unmatchedStores.length > 0" class="card">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>以下门店未找到匹配的计提模板</template>
          <div>
            <span v-for="s in unmatchedStores" :key="s" class="unmatched-store">{{ s }}</span>
            <div style="margin-top: var(--spacing-sm);">请前往"基础配置 > 计提模板管理"添加对应模板</div>
          </div>
        </el-alert>
      </div>
    </template>

    <!-- 批次不存在 -->
    <div v-else class="card not-found-card">
      <EmptyState description="批次不存在或已被删除" action-text="返回批次列表" @action="navigateTo('/invoices/batches')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { generateReimbursementText } from '~/utils/reimbursement'
import { getNextMonth, isValidMonth } from '~/utils/month'
import { splitInvoiceAmount, buildDefaultInvoiceMapping } from '~/utils/invoice-allocation'

const route = useRoute()
const batchId = Number(route.params.id)

const { batchList, getBatchById, formatBatchNo, fetchBatchById } = useInvoiceData()
const { findByCarrierStore, findByCarrierStoreOrDept, filterItemsByStore, findByCarrier, templateList, fetchTemplates } = useTemplateData()
const { detailList, getDetailById, findByCarrierMonth, fetchDetails } = useDetailData()
const { generateAccrual } = useAccrualData()
const { schemeList, fetchFeeSchemes, findByCarrier: findSchemesByCarrier } = useFeeSchemeData()

const batch = computed(() => getBatchById(batchId))
const batchNo = computed(() => batch.value ? formatBatchNo(batch.value) : '')

// 权限：生成计提表需管理员/操作员（对齐 /api/accruals/generate POST）；查看者仅可预览
const canWrite = ref(false)

const isTelecom = computed(() => batch.value?.carrier === '中国电信')

// 计提方式选择
const generateMethod = ref<'detail' | 'invoice' | 'allocation'>('invoice')

// 费用分摊方案选择
const selectedSchemeId = ref(0)
const manualAdjustments = ref<Record<string, number>>({})

// 可用的费用分摊方案（当前运营商 + 通用方案）
const availableSchemes = computed(() => {
  if (!batch.value) return []
  return findSchemesByCarrier(batch.value.carrier)
})

// 当前选择的方案
const selectedScheme = computed(() => {
  if (!selectedSchemeId.value) return null
  return schemeList.value.find(s => s.id === selectedSchemeId.value) || null
})

// 明细表手动选择
const selectedDetailId = ref<number | undefined>(undefined)

// 可用的明细表列表（该运营商的所有明细表）
const availableDetailTables = computed(() => {
  if (!batch.value) return []
  return detailList.value.filter(d => d.carrier === batch.value!.carrier)
})

// 当前选择的明细表对象
const selectedDetailTable = computed(() => {
  if (selectedDetailId.value === undefined || selectedDetailId.value === 0) return undefined
  return getDetailById(selectedDetailId.value)
})

// 是否按明细表方式生成
const useDetailMode = computed(() => selectedDetailId.value !== undefined && selectedDetailId.value > 0)

// 明细表选择变化
function onDetailChange() {
  generatePreview()
}

// 预览组数据
const previewGroups = ref<PreviewGroup[]>([])
const generating = ref(false)

// 计提月份（默认费用月的下个月）
const accrualMonth = ref('')

// 发票 → 明细行映射（按门店：发票ID → 明细行索引数组）
const invoiceMapping = ref<Record<string, Record<number, number[]>>>({})
// 映射行金额手动覆盖（按门店：行索引 → 金额）
const invoiceRowOverrides = ref<Record<string, Record<number, number>>>({})
// 待提交的发票分配（按门店：行索引 + 金额 + 发票ID）
const pendingInvoiceAllocations = ref<Record<string, { rowIndex: number; amount: number; invoiceIds: number[] }[]>>({})

interface PreviewGroup {
  store: string
  invoiceAmount: number
  selectedTemplateId: number
  rows: any[]
  subtotal: number
  reimbursementText: string
}

// 无匹配模板的门店
const unmatchedStores = computed(() => {
  if (!batch.value) return []
  const stores = new Set<string>()
  for (const invoice of batch.value.invoices) {
    for (const s of invoice.stores) {
      stores.add(s)
    }
  }
  return Array.from(stores).filter(s => !findByCarrierStoreOrDept(batch.value!.carrier, s))
})

// 批次发票总额（allocation 模式下展示用）
const batchTotalInvoice = computed(() => {
  if (!batch.value) return 0
  return batch.value.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
})

// 分摊差额：每个门店的累计剩余发票金额（递减到最后一个为 0）
const groupRemaining = computed<number[]>(() => {
  if (previewGroups.value.length === 0) return []
  // allocation 模式下 invoiceAmount=subtotal，需取实际发票总额作为基准
  const totalInvoice = generateMethod.value === 'allocation'
    ? batchTotalInvoice.value
    : previewGroups.value[0]!.invoiceAmount
  let cumulative = 0
  return previewGroups.value.map((g, idx) => {
    cumulative += g.subtotal
    // 最后一个门店强制返回 0，消除浮点误差
    if (idx === previewGroups.value.length - 1) return 0
    return Math.max(0, totalInvoice - cumulative)
  })
})

// 汇总报销说明：合并所有门店的行，生成一句汇总文本
const consolidatedReimbursementText = computed(() => {
  if (previewGroups.value.length === 0 || !batch.value) return ''
  const firstGroup = previewGroups.value[0]!
  const allRows: { dept: string[], name: string, amount: number, feeType?: string, unit?: string }[] = []
  for (const g of previewGroups.value) {
    for (const row of g.rows) {
      allRows.push({ dept: row.dept, name: row.name, amount: row.amount, feeType: row.feeType, unit: row.unit })
    }
  }
  let storeLabel: string
  let format: string
  let custom: string
  if (generateMethod.value === 'allocation') {
    storeLabel = selectedScheme.value?.name || '费用分摊方案'
    format = selectedScheme.value?.reimbursementFormat || ''
    custom = selectedScheme.value?.reimbursementCustom || ''
  } else {
    storeLabel = previewGroups.value.map(g => g.store).join('、')
    const template = templateList.value.find(t => t.id === firstGroup.selectedTemplateId)
    format = template?.reimbursementFormat || ''
    custom = template?.reimbursementCustom || ''
  }
  return generateReimbursementText(
    format,
    custom,
    allRows,
    storeLabel,
    batch.value.feeMonth,
    batch.value.carrier,
  )
})

// 获取门店可用的模板
function getAvailableTemplates(store: string) {
  if (!batch.value) return []
  // 优先显示同运营商同门店的模板，也允许选择其他模板
  return templateList.value.filter(t => t.carrier === batch.value!.carrier)
}

// 生成来源文本
function getSourceText(source: string): string {
  const map: Record<string, string> = {
    detail: '明细表',
    invoice: '发票',
    calculated: '倒推',
    preset: '预设',
    allocation: '分摊',
    manual: '手动',
  }
  return map[source] || source
}

function getSourceType(source: string): 'primary' | 'success' | 'warning' | 'info' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
    detail: 'success',
    invoice: 'primary',
    calculated: 'warning',
    preset: 'info',
    allocation: 'primary',
    manual: 'warning',
  }
  return map[source] || 'info'
}

// ============================================
// 发票 → 计提明细行 映射（仅按发票模式）
// ============================================

interface InvoiceMappingGroup {
  store: string
  templateItems: any[]
  invoices: any[]
}

// 生成页映射分组：门店 + 该门店模板明细行 + 该门店发票
const invoiceMappingGroups = computed<InvoiceMappingGroup[]>(() => {
  if (!batch.value || generateMethod.value !== 'invoice') return []
  const storeSet = new Set<string>()
  for (const invoice of batch.value.invoices) {
    for (const store of (invoice.stores as string[]) || []) storeSet.add(store)
  }
  const groups: InvoiceMappingGroup[] = []
  for (const store of storeSet) {
    const template = findByCarrierStoreOrDept(batch.value.carrier, store)
    if (!template) continue
    const templateItems = filterItemsByStore(template.items || [], store)
    const invoices = batch.value.invoices.filter(invoice => ((invoice.stores as string[]) || []).includes(store))
    groups.push({ store, templateItems, invoices })
  }
  return groups
})

// 是否存在任何发票→行映射
const hasInvoiceMapping = computed(() => {
  for (const storeMapping of Object.values(invoiceMapping.value)) {
    if (storeMapping && Object.keys(storeMapping).length > 0) return true
  }
  return false
})

// 初始化映射：发票数 = 明细行数时按顺序 1:1，否则留空（由用户手动选择）
function initInvoiceMapping() {
  const mapping: Record<string, Record<number, number[]>> = {}
  for (const group of invoiceMappingGroups.value) {
    const defaults = buildDefaultInvoiceMapping(
      group.invoices.map(invoice => ({ id: invoice.id, amount: Number(invoice.amount) })),
      group.templateItems.length,
    )
    const storeMap: Record<number, number[]> = {}
    for (const [invoiceId, rowIndexes] of defaults) {
      storeMap[invoiceId] = rowIndexes
    }
    mapping[group.store] = storeMap
  }
  invoiceMapping.value = mapping
  invoiceRowOverrides.value = {}
}

// 修改某张发票对应的明细行（可多选）
function setInvoiceRowMapping(store: string, invoiceId: number, rowIndexes: number[]) {
  if (!invoiceMapping.value[store]) invoiceMapping.value[store] = {}
  if (rowIndexes.length === 0) {
    delete invoiceMapping.value[store][invoiceId]
  } else {
    invoiceMapping.value[store][invoiceId] = [...rowIndexes]
  }
  invoiceRowOverrides.value = {}
  generatePreview()
}

// 某门店按顺序重置映射
function resetInvoiceMapping(store: string) {
  const group = invoiceMappingGroups.value.find(g => g.store === store)
  if (!group) return
  const defaults = buildDefaultInvoiceMapping(
    group.invoices.map(invoice => ({ id: invoice.id, amount: Number(invoice.amount) })),
    group.templateItems.length,
  )
  const storeMap: Record<number, number[]> = {}
  for (const [invoiceId, rowIndexes] of defaults) {
    storeMap[invoiceId] = rowIndexes
  }
  invoiceMapping.value[store] = storeMap
  invoiceRowOverrides.value = {}
  generatePreview()
}

// 映射行金额手动修改
function onInvoiceRowAmountChange(store: string, row: number, value: number | undefined | null) {
  if (!invoiceRowOverrides.value[store]) invoiceRowOverrides.value[store] = {}
  if (value == null || !Number.isFinite(value)) {
    delete invoiceRowOverrides.value[store][row]
  } else {
    invoiceRowOverrides.value[store][row] = Math.round(value * 100) / 100
  }
  generatePreview()
}

// 生成预览数据
function generatePreview() {
  if (!batch.value) return

  // 每次重算前清空待提交的发票分配（本次预览会重新生成）
  pendingInvoiceAllocations.value = {}

  if (generateMethod.value === 'allocation') {
    generateAllocationPreview()
    return
  }

  // 按门店分组发票
  const storeInvoiceMap = new Map<string, { invoice: any }[]>()
  for (const invoice of batch.value.invoices) {
    for (const store of invoice.stores) {
      if (!storeInvoiceMap.has(store)) {
        storeInvoiceMap.set(store, [])
      }
      storeInvoiceMap.get(store)!.push({ invoice })
    }
  }

  // 发票总额（所有发票去重求和）
  const totalInvoiceAmount = batch.value.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)

  // --- 按明细表模式：两遍计算 ---
  // 第一遍：计算每个门店的号码费用，汇总所有号码费用
  const storePhoneTotals = new Map<string, number>()
  const storeTemplates = new Map<string, any>()
  const storeEffectiveRowsMap = new Map<string, any[]>()
  let allPhoneTotal = 0

  if (useDetailMode.value && selectedDetailTable.value) {
    for (const [store] of storeInvoiceMap) {
      const template = findByCarrierStoreOrDept(batch.value.carrier, store)
      if (!template) continue
      storeTemplates.set(store, template)

      // 明细表 sheet 匹配：精确 → 包含 → 全 sheet 汇总
      const allSheets = (selectedDetailTable.value.sheets as any[]) || []
      let sheet = allSheets.find((s: any) => s.store === store)
      if (!sheet) {
        sheet = allSheets.find((s: any) => s.store?.includes(store) || store.includes(s.store || ''))
      }
      const effectiveRows = (sheet
        ? (sheet.rows as any[]) || []
        : allSheets.flatMap((s: any) => (s.rows as any[]) || [])
      ).filter((r: any) => /^[\d\-]+$/.test(String(r.number || '').trim()))
      if (!sheet && allSheets.length > 0) {
        console.warn(`[计提] 未找到门店「${store}」对应的明细表 sheet，已汇总全部 sheet 行作为兜底。可用 sheet:`, allSheets.map(s => s.store))
      }
      storeEffectiveRowsMap.set(store, effectiveRows)

      // 按门店过滤模板 items（支持一个模板覆盖多门店）
      const filteredItems = filterItemsByStore(template.items, store)
      let phoneTotal = 0
      for (const item of filteredItems) {
        if (/^[\d\-]+$/.test(item.name)) {
          const cleanName = item.name.replace(/[\s\-]/g, '')
          const detailRow = effectiveRows.find((r: any) => String(r.number).replace(/[\s\-]/g, '') === cleanName)
          phoneTotal += detailRow ? Number(detailRow.totalFee) || 0 : 0
        }
      }
      storePhoneTotals.set(store, phoneTotal)
      allPhoneTotal += phoneTotal
    }
  }

  // 非号码费用 = 发票总额 - 所有门店号码费用之和（跨门店倒推）
  const crossStoreNonPhoneTotal = totalInvoiceAmount - allPhoneTotal
  let nonPhoneAssigned = false

  const groups: PreviewGroup[] = []

  for (const [store, invoiceShares] of storeInvoiceMap) {
    const template = useDetailMode.value
      ? storeTemplates.get(store) || findByCarrierStoreOrDept(batch.value.carrier, store)
      : findByCarrierStoreOrDept(batch.value.carrier, store)
    if (!template) continue

    // 发票金额：按明细表模式显示完整发票总额，按发票模式仍为均摊
    const invoiceAmount = useDetailMode.value
      ? totalInvoiceAmount
      : invoiceShares.reduce((sum: number, is: any) => sum + is.invoice.amount / (is.invoice.stores?.length || 1), 0)
    // 按门店过滤模板 items（支持一个模板覆盖多门店）
    const templateItems = filterItemsByStore(template.items, store)
    const rows: any[] = []

    if (useDetailMode.value && selectedDetailTable.value) {
      const effectiveRows = storeEffectiveRowsMap.get(store) || []

      for (const item of templateItems) {
        const isPhone = /^[\d\-]+$/.test(item.name)
        let amount = 0

        if (isPhone) {
          const cleanName = item.name.replace(/[\s\-]/g, '')
          const detailRow = effectiveRows.find((r: any) => String(r.number).replace(/[\s\-]/g, '') === cleanName)
          amount = detailRow ? Number(detailRow.totalFee) || 0 : 0
        } else {
          // 非号码项：跨门店倒推，只分配给第一个有非号码项的门店
          if (!nonPhoneAssigned) {
            amount = crossStoreNonPhoneTotal
            nonPhoneAssigned = true
          }
        }

        rows.push({
          dept: [...item.dept],
          name: item.name,
          amount,
          remark: item.remark,
          source: isPhone ? 'detail' : 'calculated',
          unit: item.unit || '',
        })
      }
    } else {
      // 按发票模式：优先按「发票 → 明细行」映射分摊；未映射行保留模板预设/0；无映射时沿用原有规则
      const storeMapping = invoiceMapping.value[store] || {}
      const rowAllocations = new Map<number, { amount: number; invoiceIds: number[] }>()
      for (const [invoiceIdKey, rowIndexes] of Object.entries(storeMapping)) {
        const invoiceId = Number(invoiceIdKey)
        const invoice = batch.value.invoices.find(inv => inv.id === invoiceId)
        if (!invoice || !Array.isArray(rowIndexes) || rowIndexes.length === 0) continue
        // 多门店发票按门店均分（移动为单门店，分摊额即发票金额）
        const storeShare = Number(invoice.amount) / (((invoice.stores as string[] | undefined)?.length) || 1)
        const parts = splitInvoiceAmount(storeShare, rowIndexes.length)
        rowIndexes.forEach((rowIndex, partIndex) => {
          const acc = rowAllocations.get(rowIndex) || { amount: 0, invoiceIds: [] as number[] }
          acc.amount += parts[partIndex] || 0
          if (!acc.invoiceIds.includes(invoiceId)) acc.invoiceIds.push(invoiceId)
          rowAllocations.set(rowIndex, acc)
        })
      }

      if (rowAllocations.size > 0) {
        const allocationList: { rowIndex: number; amount: number; invoiceIds: number[] }[] = []
        templateItems.forEach((item: any, index: number) => {
          const alloc = rowAllocations.get(index)
          if (alloc) {
            const override = invoiceRowOverrides.value[store]?.[index]
            const amount = override != null ? override : Math.round(alloc.amount * 100) / 100
            allocationList.push({ rowIndex: index, amount, invoiceIds: alloc.invoiceIds })
            rows.push({
              dept: [...item.dept],
              name: item.name,
              amount,
              remark: item.remark,
              source: 'invoice',
              unit: item.unit || '',
              isInvoiceMapped: true,
              _store: store,
              _rowIndex: index,
            })
          } else {
            rows.push({
              dept: [...item.dept],
              name: item.name,
              amount: Number(item.amount) || 0,
              remark: item.remark,
              source: 'preset',
              unit: item.unit || '',
            })
          }
        })
        pendingInvoiceAllocations.value[store] = allocationList
      } else {
        // 无映射：沿用原有规则（预设金额优先，否则发票总额进首行）
        const hasPresetAmounts = templateItems.some((item: any) => Number(item.amount) > 0)
        if (hasPresetAmounts) {
          for (const item of templateItems) {
            rows.push({
              dept: [...item.dept],
              name: item.name,
              amount: Number(item.amount) || 0,
              remark: item.remark,
              source: 'preset',
              unit: item.unit || '',
            })
          }
        } else {
          let itemIdx = 0
          for (const item of templateItems) {
            rows.push({
              dept: [...item.dept],
              name: item.name,
              amount: itemIdx === 0 ? invoiceAmount : 0,
              remark: item.remark,
              source: itemIdx === 0 ? 'invoice' : 'preset',
              unit: item.unit || '',
            })
            itemIdx++
          }
        }
      }
    }

    const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)

    // 生成报销说明预览
    const reimbursementText = generateReimbursementText(
      template.reimbursementFormat,
      template.reimbursementCustom,
      rows.map((r, i) => ({ seq: i + 1, ...r })),
      store,
      batch.value.feeMonth,
      batch.value.carrier,
    )

    groups.push({
      store,
      invoiceAmount,
      selectedTemplateId: template.id,
      rows,
      subtotal,
      reimbursementText,
    })
  }

  previewGroups.value = groups
}

// allocation 模式预览生成
function generateAllocationPreview() {
  if (!batch.value || !selectedScheme.value) {
    previewGroups.value = []
    return
  }

  const totalInvoiceAmount = batch.value.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
  const schemeItems = (selectedScheme.value.items as any[]) || []
  const storeRowsMap = new Map<string, any[]>()

  for (const item of schemeItems) {
    let itemAmount = 0
    if (item.amountSource === 'fixed') {
      itemAmount = Number(item.fixedAmount) || 0
    } else if (item.amountSource === 'invoice') {
      itemAmount = totalInvoiceAmount
    }

    // safeguard: amountSource='manual' 时强制使用 manual 分摊方式，避免 ratio/quantity 产生 0 值
    const effectiveAllocationMode = item.amountSource === 'manual' ? 'manual' : item.allocationMode
    const allocations = (item.allocations as any[]) || []
    const sumValues = allocations.reduce((s: number, a: any) => s + (Number(a.value) || 0), 0)

    for (const alloc of allocations) {
      let storeAmount = 0
      switch (effectiveAllocationMode) {
        case 'fixed':
          storeAmount = Number(alloc.value) || 0
          break
        case 'ratio':
          storeAmount = itemAmount * (Number(alloc.value) || 0) / 100
          break
        case 'quantity':
          storeAmount = sumValues > 0 ? itemAmount * (Number(alloc.value) || 0) / sumValues : 0
          break
        case 'manual': {
          const key = `${item.name}::${alloc.store}`
          storeAmount = Number(manualAdjustments.value[key] ?? manualAdjustments.value[alloc.store] ?? 0)
          break
        }
      }

      if (!storeRowsMap.has(alloc.store)) {
        storeRowsMap.set(alloc.store, [])
      }
      storeRowsMap.get(alloc.store)!.push({
        dept: [...(alloc.dept as string[])],
        name: item.name,
        amount: storeAmount,
        remark: item.remark || '',
        source: effectiveAllocationMode === 'manual' ? 'manual' : 'allocation',
        feeType: item.feeType || '',
        unit: item.unit || '',
        // 手动费用项的 key，用于在预览中显示输入框
        manualKey: effectiveAllocationMode === 'manual' ? `${item.name}::${alloc.store}` : '',
        isManual: effectiveAllocationMode === 'manual',
      })
    }
  }

  const groups: PreviewGroup[] = []
  for (const [store, rows] of storeRowsMap) {
    const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
    const reimbursementText = generateReimbursementText(
      selectedScheme.value!.reimbursementFormat || '',
      selectedScheme.value!.reimbursementCustom || '',
      rows.map(r => ({ dept: r.dept, name: r.name, amount: r.amount, feeType: r.feeType, unit: r.unit })),
      store,
      batch.value.feeMonth,
      batch.value.carrier,
    )
    groups.push({
      store,
      invoiceAmount: subtotal,
      selectedTemplateId: 0,
      rows,
      subtotal,
      reimbursementText,
    })
  }
  previewGroups.value = groups
}

// 手动费用项输入变化时重新计算
function onManualAmountChange() {
  generateAllocationPreview()
}

// 方案选择变化
function onSchemeChange() {
  manualAdjustments.value = {}
  generateAllocationPreview()
}

// 计提方式变化
function onMethodChange() {
  if (generateMethod.value === 'allocation') {
    // 自动选择第一个可用方案
    if (availableSchemes.value.length > 0 && !selectedSchemeId.value) {
      selectedSchemeId.value = availableSchemes.value[0]!.id
    }
    onSchemeChange()
  } else {
    // 切到发票模式时，若尚无映射则按顺序初始化
    if (generateMethod.value === 'invoice' && !hasInvoiceMapping.value) {
      initInvoiceMapping()
    }
    generatePreview()
  }
}

// 更新预览组（模板变更时）
function updatePreviewGroup(group: PreviewGroup) {
  // 模板变更时重新生成预览（简化版：直接重新生成全部）
  generatePreview()
  // 恢复选择的模板
  const groupData = previewGroups.value.find(g => g.store === group.store)
  if (groupData) {
    groupData.selectedTemplateId = group.selectedTemplateId
  }
}

// 确认生成：按页面所选计提月份生成
async function handleGenerate() {
  if (!batch.value) return

  if (generateMethod.value !== 'allocation' && unmatchedStores.value.length > 0) {
    ElMessage.warning('存在未匹配模板的门店，请先添加模板')
    return
  }

  if (generateMethod.value === 'allocation' && !selectedSchemeId.value) {
    ElMessage.warning('请先选择费用分摊方案')
    return
  }

  if (!isValidMonth(accrualMonth.value)) {
    ElMessage.warning('请选择有效的计提月份')
    return
  }

  generating.value = true
  try {
    let result: any = null

    if (generateMethod.value === 'allocation') {
      result = await generateAccrual({
        batchId,
        schemeId: selectedSchemeId.value,
        manualAdjustments: manualAdjustments.value,
        feeMonth: accrualMonth.value,
      })
    } else {
      const templateOverrides: Record<string, number> = {}
      for (const g of previewGroups.value) {
        templateOverrides[g.store] = g.selectedTemplateId
      }
      // 发票模式且存在「发票 → 明细行」映射时，随生成提交分配结果
      const allocations: Record<string, { rowIndex: number; amount: number; invoiceIds: number[] }[]> = {}
      if (generateMethod.value === 'invoice') {
        for (const [store, list] of Object.entries(pendingInvoiceAllocations.value)) {
          if (list.length > 0) allocations[store] = list
        }
      }
      result = await generateAccrual({
        batchId,
        templateOverrides,
        detailTableId: selectedDetailId.value ?? undefined,
        feeMonth: accrualMonth.value,
        ...(Object.keys(allocations).length > 0 ? { invoiceAllocations: allocations } : {}),
      })
    }

    if (result) {
      ElMessage.success('计提表生成成功')
      navigateTo(`/accruals/${result.id}`)
    }
  } finally {
    generating.value = false
  }
}

// 初始化
onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canWrite.value = role === '管理员' || role === '操作员'
    } catch { canWrite.value = false }
  }
  // 确保批次、模板、明细表数据已加载
  if (!getBatchById(batchId)) {
    // fetchBatchById 仅返回结果不同步列表，直接进入本页时补写入（batch computed 依赖内存列表）
    const fetched = await fetchBatchById(batchId)
    if (fetched && !getBatchById(batchId)) {
      batchList.value.push(fetched)
    }
  }
  // 默认计提月份 = 费用月的下个月
  if (batch.value) {
    accrualMonth.value = getNextMonth(batch.value.feeMonth) || batch.value.feeMonth
  }
  if (templateList.value.length === 0) {
    await fetchTemplates()
  }
  if (detailList.value.length === 0) {
    await fetchDetails()
  }
  if (schemeList.value.length === 0) {
    await fetchFeeSchemes()
  }

  // 默认计提方式：电信=按明细表，其他=按发票
  if (batch.value && isTelecom.value) {
    generateMethod.value = 'detail'
    const autoMatch = findByCarrierMonth(batch.value.carrier, batch.value.feeMonth)
    selectedDetailId.value = autoMatch ? autoMatch.id : 0
  } else {
    generateMethod.value = 'invoice'
    selectedDetailId.value = 0
  }
  // 发票模式：按顺序初始化「发票 → 明细行」映射（发票数=行数时 1:1）
  if (generateMethod.value === 'invoice') {
    initInvoiceMapping()
  }
  generatePreview()
})
</script>

<style scoped>
.batch-info-card {
  margin-bottom: var(--spacing-card);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-card);
}

.section-title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--text-primary);
}

.group-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-btn-gap);
}

.amount-highlight {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--color-primary);
}

.detail-info {
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.divider {
  margin: 0 var(--spacing-sm);
  color: var(--text-placeholder);
}

.dept-tag {
  margin-right: 4px;
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}

.group-footer {
  display: flex;
  align-items: center;
  gap: var(--spacing-card);
  margin-top: var(--spacing-btn-gap);
  padding: var(--spacing-sm) var(--spacing-card);
  background: var(--bg-page);
  border-radius: var(--radius-input);
}

.subtotal-text {
  font-size: var(--font-size-body);
  font-weight: 600;
  color: var(--text-primary);
}

.diff-warn {
  font-size: var(--font-size-mini);
  color: var(--color-danger);
}

.unmatched-store {
  display: inline-block;
  margin-right: var(--spacing-sm);
  padding: 2px var(--spacing-sm);
  background: var(--color-danger);
  color: var(--color-white);
  border-radius: var(--radius-btn);
  font-size: var(--font-size-mini);
}

.not-found-card {
  padding: 60px 0;
}

.consolidated-card {
  border: 2px solid var(--color-primary-border);
}

.accrual-month-form {
  margin-bottom: var(--spacing-sm);
}

.month-hint {
  margin-left: var(--spacing-sm);
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.invoice-map-group {
  margin-top: var(--spacing-btn-gap);
}

.invoice-map-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--spacing-sm);
}

.invoice-map-store {
  font-weight: 600;
  color: var(--text-primary);
}
</style>
