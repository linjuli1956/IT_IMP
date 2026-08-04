<template>
  <div class="page-container">
    <PageHeader title="计提表列表" />

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 从"批次详情"页面点击"生成计提表"创建计提表，电信按明细表匹配、移动联通按发票金额</p>
        <p>2. 点击"查看"进入计提表详情，可查看按门店分组的计提明细</p>
        <p>3. 计提表支持A5打印（A4纸上下排2张A5），勾选多张可批量打印，报销说明在详情页可复制</p>
        <p>4. 电信计提的号码行从明细表取费用，非号码行通过倒推计算（发票总额 - 号码行之和）</p>
      </div>
    </el-alert>

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
        :columns="columns"
        :data="filteredList"
        :loading="loading"
        show-batch-print
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
          <el-button size="small" @click="navigateTo(`/accruals/${row.id}`)">查看</el-button>
          <el-button size="small" type="primary" @click="handlePrint(row)">打印</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>

      <!-- 空状态提示 -->
      <div v-if="filteredList.length === 0" class="empty-hint">
        <el-empty description="暂无计提表，请从批次详情页面生成">
          <el-button type="primary" @click="navigateTo('/invoices/batches')">前往批次列表</el-button>
        </el-empty>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'

const { accrualList, loading, fetchAccruals, deleteAccrual, deleteAccruals, getStatusText, getStatusType, getMethodText } = useAccrualData()

onMounted(() => {
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

// 单个打印
function handlePrint(row: any) {
  printAccrual(row)
}

// 批量打印
function handleBatchPrint(rows: any[]) {
  printAccruals(rows)
  ElMessage.success(`正在打印 ${rows.length} 张计提表`)
}
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}

.batch-no-text {
  font-weight: 600;
  color: var(--text-primary);
}

.amount-highlight {
  font-weight: 600;
  color: var(--color-primary);
}

.empty-hint {
  padding: 40px 0;
}
</style>
