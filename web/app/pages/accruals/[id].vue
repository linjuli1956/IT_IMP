<template>
  <div class="page-container" v-loading="loading">
    <PageHeader :title="`计提表详情 ${accrual?.batchNo || ''}`">
      <template #actions>
        <el-button @click="navigateTo('/accruals')">返回列表</el-button>
        <el-button @click="copyAllReimbursement">
          <el-icon><CopyDocument /></el-icon>
          复制报销说明
        </el-button>
        <el-button type="success" @click="handlePrint">
          <el-icon><Printer /></el-icon>
          A5打印
        </el-button>
        <el-button type="primary" @click="handleDownload">下载Excel</el-button>
        <el-button v-if="isAllocation" type="warning" @click="handleEdit">
          <el-icon><Edit /></el-icon>
          编辑费用项
        </el-button>
      </template>
    </PageHeader>

    <template v-if="accrual">
      <!-- 基本信息 -->
      <div class="card info-card">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="批次号">{{ accrual.batchNo }}</el-descriptions-item>
          <el-descriptions-item label="运营商">{{ accrual.carrier }}</el-descriptions-item>
          <el-descriptions-item label="费用月">{{ accrual.feeMonth }}</el-descriptions-item>
          <el-descriptions-item label="计提方式">
            <el-tag size="small" :type="accrual.method === 'detail' ? 'warning' : accrual.method === 'allocation' ? 'success' : 'info'">
              {{ getMethodText(accrual.method) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="门店数">{{ accrual.groups.length }} 个</el-descriptions-item>
          <el-descriptions-item label="合计金额">
            <span class="amount-highlight">¥ {{ accrual.totalAmount.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="制表人">{{ accrual.creator }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getStatusType(accrual.status)" size="small">
              {{ getStatusText(accrual.status) }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 按门店分组的计提表 -->
      <div v-for="(group, idx) in accrual.groups" :key="idx" class="card">
        <div class="section-header">
          <span class="section-title">{{ group.store }}</span>
          <div class="group-meta">
            <el-tag type="info" size="small">发票金额：¥ {{ (isAllocation ? batchTotalInvoice : group.invoiceAmount).toFixed(2) }}</el-tag>
            <el-tag type="primary" size="small">小计：¥ {{ group.subtotal.toFixed(2) }}</el-tag>
            <el-tag v-if="isAllocation" :type="(groupRemaining[idx] ?? 0) > 0.01 ? 'danger' : 'success'" size="small">
              待分摊：¥ {{ (groupRemaining[idx] ?? 0).toFixed(2) }}
            </el-tag>
          </div>
        </div>

        <el-table :data="group.rows" border stripe size="small" style="width: 100%">
          <el-table-column label="序号" width="60" align="center">
            <template #default="{ row }">{{ row.seq }}</template>
          </el-table-column>
          <el-table-column label="承担部门" min-width="160">
            <template #default="{ row }">
              <el-tag v-for="d in row.dept" :key="d" size="small" type="info" class="dept-tag">{{ d }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称/号码" min-width="160" />
          <el-table-column v-if="isAllocation" label="费用类型" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.feeType" size="small" type="warning">{{ row.feeType }}</el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="费用" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-text">¥ {{ row.amount.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="来源" width="90" align="center">
            <template #default="{ row }">
              <el-tag size="small" :type="getSourceType(row.source)">{{ getSourceText(row.source) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
        </el-table>
      </div>

      <!-- 汇总报销说明（合并） -->
      <div class="card consolidated-card">
        <ReimbursementText
          :text="consolidatedReimbursementText"
          label="汇总报销说明（合并）"
          copyable
        />
      </div>
    </template>

    <!-- 计提表不存在 -->
    <div v-else class="card not-found-card">
      <el-empty description="计提表不存在或已被删除">
        <el-button type="primary" @click="navigateTo('/accruals')">返回列表</el-button>
      </el-empty>
    </div>

    <!-- 编辑费用项弹窗 -->
    <el-dialog v-model="editDialogVisible" title="编辑费用项" width="750px" :close-on-click-modal="false">
      <el-alert type="info" :closable="false" show-icon style="margin-bottom: var(--spacing-card)">
        仅可编辑手动输入的费用项金额，自动计算的项不可修改。
      </el-alert>
      <el-table :data="editRows" border stripe size="small" style="width: 100%">
        <el-table-column label="门店" prop="store" width="120" />
        <el-table-column label="费用类型" prop="feeType" width="100" />
        <el-table-column label="名称/号码" prop="name" min-width="140" />
        <el-table-column label="来源" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.source === 'manual' ? 'warning' : 'info'">
              {{ getSourceText(row.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="160" align="right">
          <template #default="{ row }">
            <el-input-number
              v-if="row.source === 'manual'"
              v-model="row.amount"
              :precision="2"
              :step="0.01"
              :min="0"
              size="small"
              controls-position="right"
              style="width: 140px"
            />
            <span v-else class="amount-text">¥ {{ row.amount.toFixed(2) }}</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="handleEditSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { CopyDocument, Printer, Edit } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { generateReimbursementText } from '~/composables/useAccrualData'
import type { AccrualGroup } from '~/types/accrual'

const route = useRoute()
const accrualId = Number(route.params.id)

const { fetchAccrualById, getStatusText, getStatusType, getMethodText, updateAccrualStatus, updateAccrual } = useAccrualData()
const { printAccrual: doPrint } = useAccrualPrint()
const { schemeList, fetchFeeSchemes, getById: getSchemeById } = useFeeSchemeData()
const { fetchBatchById } = useInvoiceData()

const accrual = ref<Accrual | null>(null)
const loading = ref(false)
const isAllocation = computed(() => accrual.value?.method === 'allocation')

// allocation 模式下存储的 invoiceAmount=subtotal，需从批次获取实际发票总额
const batchTotalInvoice = ref(0)

// 分摊差额：每个门店的累计剩余发票金额（递减到最后一个为 0）
const groupRemaining = computed<number[]>(() => {
  if (!accrual.value || accrual.value.groups.length === 0) return []
  // allocation 模式取批次发票总额，其他模式取 groups[0].invoiceAmount
  const totalInvoice = isAllocation.value
    ? batchTotalInvoice.value
    : accrual.value.groups[0]!.invoiceAmount
  let cumulative = 0
  return accrual.value.groups.map((g, idx) => {
    cumulative += g.subtotal
    // 最后一个门店强制返回 0，消除浮点误差
    if (idx === accrual.value!.groups.length - 1) return 0
    return Math.max(0, totalInvoice - cumulative)
  })
})

// 编辑费用项状态
const editDialogVisible = ref(false)
const editSaving = ref(false)
const editRows = ref<{ store: string, feeType: string, name: string, source: string, amount: number, _groupIdx: number, _rowIdx: number }[]>([])

function handleEdit() {
  if (!accrual.value) return
  editRows.value = []
  accrual.value.groups.forEach((g, gIdx) => {
    g.rows.forEach((r, rIdx) => {
      editRows.value.push({
        store: g.store,
        feeType: r.feeType || '',
        name: r.name,
        source: r.source,
        amount: r.amount,
        _groupIdx: gIdx,
        _rowIdx: rIdx,
      })
    })
  })
  editDialogVisible.value = true
}

async function handleEditSave() {
  if (!accrual.value) return
  editSaving.value = true
  try {
    const updatedGroups = JSON.parse(JSON.stringify(accrual.value.groups)) as AccrualGroup[]
    for (const er of editRows.value) {
      if (er.source === 'manual') {
        updatedGroups[er._groupIdx]!.rows[er._rowIdx]!.amount = er.amount
      }
    }
    const result = await updateAccrual(accrualId, { groups: updatedGroups })
    if (result) {
      accrual.value = result
      ElMessage.success('保存成功')
      editDialogVisible.value = false
    }
  } finally {
    editSaving.value = false
  }
}

onMounted(async () => {
  loading.value = true
  accrual.value = await fetchAccrualById(accrualId)
  // allocation 模式：加载方案数据 + 批次发票总额（用于分摊差额计算）
  if (accrual.value?.method === 'allocation') {
    await Promise.all([
      fetchFeeSchemes(),
      fetchBatchById(accrual.value.batchId).then(batch => {
        if (batch) {
          batchTotalInvoice.value = batch.invoices.reduce((sum: number, inv: any) => sum + inv.amount, 0)
        }
      }),
    ])
  }
  loading.value = false
})

// 汇总报销说明：合并所有门店的行，生成一句汇总文本
const consolidatedReimbursementText = computed(() => {
  if (!accrual.value || accrual.value.groups.length === 0) return ''
  const firstGroup = accrual.value.groups[0]!
  // 收集所有门店的行
  const allRows: { dept: string[], name: string, amount: number, feeType?: string }[] = []
  for (const g of accrual.value.groups) {
    for (const row of g.rows) {
      allRows.push({ dept: row.dept, name: row.name, amount: row.amount, feeType: row.feeType })
    }
  }
  // allocation 模式：用方案名称替代门店列表，避免多门店时文本过长
  let storeLabel: string
  if (accrual.value.method === 'allocation' && firstGroup.schemeId > 0) {
    storeLabel = getSchemeById(firstGroup.schemeId)?.name || '费用分摊方案'
  } else {
    storeLabel = accrual.value.groups.map(g => g.store).join('、')
  }
  return generateReimbursementText(
    firstGroup.reimbursementFormat,
    firstGroup.reimbursementCustom,
    allRows,
    storeLabel,
    accrual.value.feeMonth,
    accrual.value.carrier,
  )
})

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
    allocation: 'success',
    manual: 'warning',
  }
  return map[source] || 'info'
}

// 复制所有报销说明（合计）
async function copyAllReimbursement() {
  if (!accrual.value) return
  const allText = accrual.value.groups.map(g => g.reimbursementText).join('\n\n')
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(allText)
      ElMessage.success('已复制全部报销说明')
      return
    } catch {
      // 降级到 execCommand
    }
  }
  try {
    const textarea = document.createElement('textarea')
    textarea.value = allText
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
    ElMessage.success('已复制全部报销说明')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}

// A5打印（使用共享打印函数，不含报销说明）
async function handlePrint() {
  if (!accrual.value) return
  try {
    doPrint(accrual.value)
  } catch (e: any) {
    ElMessage.error(e.message || '打印失败')
    return
  }
  // 更新状态为已打印
  await updateAccrualStatus(accrualId, 'printed')
  if (accrual.value) {
    accrual.value = { ...accrual.value, status: 'printed' }
  }
}

// 下载Excel（静态原型阶段提示）
function handleDownload() {
  ElMessage.info('Excel下载功能将在后端开发阶段实现')
}
</script>

<style scoped>
.info-card {
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

.group-meta {
  display: flex;
  gap: var(--spacing-sm);
}

.amount-highlight {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--color-primary);
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}

.dept-tag {
  margin-right: 4px;
}

.not-found-card {
  padding: 60px 0;
}

.consolidated-card {
  border: 2px solid var(--color-primary-border);
}
</style>
