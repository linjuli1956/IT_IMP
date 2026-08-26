<template>
  <div class="page-container">
    <PageHeader title="计提表列表" subtitle="运营商费用计提管理 - 打印模板选择" description="从批次详情生成计提表，电信按明细表匹配号码费用，移动/联通按发票金额生成；支持 A5/A4 打印模板选择与批量打印，报销说明在详情页可复制" />

    <!-- 筛选区 -->
    <div class="card filter-card">
      <el-form :inline="true" :model="filters">
        <el-form-item label="运营商">
          <el-select v-model="filters.carrier" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="c in carrierOptions" :key="c.value" :label="c.label" :value="c.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="费用月">
          <el-date-picker v-model="filters.feeMonth" type="month" placeholder="选择月份" value-format="YYYY-MM" style="width: 150px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="已生成" value="generated" />
            <el-option label="已打印" value="printed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 列表 -->
    <div class="card">
      <CrudTable
        v-if="loading || filteredList.length > 0"
        :columns="columns"
        :data="filteredList"
        :loading="loading"
        :show-selection="canWrite"
        show-batch-print
        :show-batch-delete="canWrite"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-print="handleBatchPrint"
      >
        <template #batchNo="{ row }">
          <span class="batch-no-text">{{ row.batchNo }}</span>
        </template>
        <template #method="{ row }">
          <el-tag size="small" :type="row.method === 'detail' ? 'warning' : 'info'">
            {{ getMethodText(row.method) }}
          </el-tag>
        </template>
        <template #storeCount="{ row }">
          <el-tag size="small" type="info">{{ row.groups.length }} 个</el-tag>
        </template>
        <template #totalAmount="{ row }">
          <span class="amount-highlight">¥ {{ row.totalAmount.toFixed(2) }}</span>
        </template>
        <template #status="{ row }">
          <el-tag :type="getStatusType(row.status)" size="small">
            {{ getStatusText(row.status) }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" text @click="navigateTo(`/accruals/${row.id}`)">查看</el-button>
          <el-button size="small" text type="primary" @click="handlePrint(row)">打印</el-button>
          <el-button v-if="canWrite" size="small" text type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>

      <EmptyState
        v-else
        description="暂无计提表，请从批次详情页面生成"
        action-text="前往批次列表"
        @action="navigateTo('/invoices/batches')"
      />
    </div>
  </div>

  <!-- 打印模板选择器 -->
  <PrintTemplateSelector
    v-model="templateDialogVisible"
    @confirm="handleTemplateConfirm"
    @cancel="handleTemplateCancel"
  />
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import PrintTemplateSelector from '~/components/common/PrintTemplateSelector.vue'

const { accrualList, loading, fetchAccruals, deleteAccrual, deleteAccruals, getStatusText, getStatusType, getMethodText } = useAccrualData()

// 权限：删除计提表需管理员/操作员（对齐 /api/accruals/:id DELETE）
const canWrite = ref(false)

// 打印模板选择弹窗
const templateDialogVisible = ref(false)
const pendingBatchRows = ref<any[]>([])

onMounted(() => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canWrite.value = role === '管理员' || role === '操作员'
    } catch { canWrite.value = false }
  }
  fetchAccruals()
})
const { printAccrual, printAccruals } = useAccrualPrint()

const carrierOptions = [
  { label: '中国电信', value: '中国电信' },
  { label: '中国联通', value: '中国联通' },
  { label: '中国移动', value: '中国移动' },
  { label: '广西广电', value: '广西广电' },
]

const columns = [
  { prop: 'batchNo', label: '批次号', width: 140, slot: 'batchNo' },
  { prop: 'carrier', label: '运营商', width: 100 },
  { prop: 'feeMonth', label: '费用月', width: 100, align: 'center' as const },
  { prop: 'method', label: '计提方式', width: 100, align: 'center' as const, slot: 'method' },
  { prop: 'storeCount', label: '门店数', width: 80, align: 'center' as const, slot: 'storeCount' },
  { prop: 'totalAmount', label: '合计金额', width: 130, align: 'right' as const, slot: 'totalAmount' },
  { prop: 'status', label: '状态', width: 90, align: 'center' as const, slot: 'status' },
  { prop: 'creator', label: '制表人', width: 80, align: 'center' as const },
  { prop: 'createTime', label: '创建时间', width: 140, align: 'center' as const },
]

// 筛选
const filters = reactive({
  carrier: '',
  feeMonth: '',
  status: '',
})

const filteredList = computed(() => {
  return accrualList.value.filter(item => {
    if (filters.carrier && item.carrier !== filters.carrier) return false
    if (filters.feeMonth && item.feeMonth !== filters.feeMonth) return false
    if (filters.status && item.status !== filters.status) return false
    return true
  })
})

function resetFilters() {
  filters.carrier = ''
  filters.feeMonth = ''
  filters.status = ''
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除批次 ${row.batchNo} 的计提表吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteAccrual(row.id)
  ElMessage.success('删除成功')
}

async function handleBatchDelete(rows: any[]) {
  const ids = rows.map(r => r.id)
  await deleteAccruals(ids)
  ElMessage.success(`已删除 ${rows.length} 项`)
}

// 单个打印 - 打开模板选择器
function handlePrint(row: any) {
  pendingBatchRows.value = [row]
  templateDialogVisible.value = true
}

// 批量打印 - 打开模板选择器
function handleBatchPrint(rows: any[]) {
  pendingBatchRows.value = rows
  templateDialogVisible.value = true
}

// 处理确认打印
function handleTemplateConfirm(template: 'a5' | 'a4') {
  const rows = pendingBatchRows.value
  try {
    if (rows.length === 1) {
      printAccrual(rows[0], template)
      ElMessage.success('正在打印...')
    } else if (rows.length > 1) {
      printAccruals(rows, template)
      ElMessage.success(`正在打印 ${rows.length} 张计提表`)
    }
  } catch (e: any) {
    // 列表页不更新打印状态；失败提示错误并清空待打印对象
    ElMessage.error(e?.message || '打印失败')
  } finally {
    pendingBatchRows.value = []
    templateDialogVisible.value = false
  }
}

// 处理取消打印 - 不更新状态
function handleTemplateCancel() {
  pendingBatchRows.value = []
  templateDialogVisible.value = false
}
</script>

<style scoped>
.filter-card {
  margin-bottom: var(--spacing-card);
}

.batch-no-text {
  font-weight: 600;
  color: var(--text-primary);
}

.amount-highlight {
  font-weight: 600;
  color: var(--color-primary);
}
</style>
