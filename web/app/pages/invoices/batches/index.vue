<template>
  <div class="page-container">
    <PageHeader title="批次列表">
      <template #actions>
        <el-button type="primary" @click="navigateTo('/invoices/upload')">
          <el-icon><Upload /></el-icon>
          上传新批次
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 批次号格式：{年月}{运营商缩写}{序号}（如 202606DX01）</p>
        <p>2. 点击"详情"进入批次详情，可查看发票列表和报销说明</p>
        <p>3. 待计提批次显示"生成计提"按钮，已计提/已打印批次显示"再次生成"</p>
        <p>4. 支持按运营商、费用月、状态筛选批次</p>
      </div>
    </el-alert>

    <!-- 筛选区 -->
    <div class="card filter-card">
      <el-form :inline="true" :model="filterForm" class="filter-form">
        <el-form-item label="运营商">
          <el-select v-model="filterForm.carrier" placeholder="全部" clearable style="width: 140px">
            <el-option v-for="opt in carrierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="费用月">
          <el-date-picker
            v-model="filterForm.feeMonth"
            type="month"
            placeholder="全部"
            format="YYYY-MM"
            value-format="YYYY-MM"
            style="width: 150px"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 120px">
            <el-option label="待计提" value="pending" />
            <el-option label="已计提" value="accrued" />
            <el-option label="已打印" value="printed" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 批次表格 -->
    <div class="card">
      <!-- 批量操作栏 -->
      <div v-if="selectedBatches.length > 0" class="batch-bar">
        <span class="batch-info">已选 {{ selectedBatches.length }} 项</span>
        <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>
      <el-table
        ref="tableRef"
        :data="filteredBatches"
        border
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="id" label="批次号" width="120" align="center">
          <template #default="{ row }">
            <span class="batch-no">{{ formatBatchNo(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="carrier" label="运营商" width="110" />
        <el-table-column prop="feeMonth" label="费用月" width="100" align="center" />
        <el-table-column prop="store" label="门店/机构" min-width="180" show-overflow-tooltip />
        <el-table-column prop="invoiceCount" label="发票数" width="80" align="center" />
        <el-table-column label="合计金额" width="130" align="right">
          <template #default="{ row }">
            <span class="amount-text">¥ {{ row.totalAmount.toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getBatchStatusType(row.status)" size="small">
              {{ getBatchStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="150" align="center" />
        <el-table-column label="操作" width="220" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="goDetail(row.id)">详情</el-button>
            <el-button
              v-if="row.status === 'pending'"
              size="small" type="primary"
              @click="handleGenerateAccrual(row)"
            >生成计提</el-button>
            <el-button
              v-else
              size="small" type="primary"
              @click="handleGenerateAccrual(row)"
            >再次生成</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredBatches.length === 0" class="empty-tip">
        <el-empty description="暂无批次数据" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { batchList, deleteBatch, deleteBatches, getBatchStatusText, getBatchStatusType, formatBatchNo, fetchBatches, loading } = useInvoiceData()

// 页面加载时获取批次列表
onMounted(() => {
  fetchBatches()
})

// 表格引用
const tableRef = ref()
const selectedBatches = ref<any[]>([])

// 选择变化
function handleSelectionChange(rows: any[]) {
  selectedBatches.value = rows
}

// 取消选择
function clearSelection() {
  tableRef.value?.clearSelection()
  selectedBatches.value = []
}

// 运营商选项
const carrierOptions = [
  { label: '中国电信', value: '中国电信' },
  { label: '中国联通', value: '中国联通' },
  { label: '中国移动', value: '中国移动' },
  { label: '广西广电', value: '广西广电' },
]

// 筛选表单
const filterForm = reactive({
  carrier: '',
  feeMonth: '',
  status: '',
})

// 筛选后的批次列表
const filteredBatches = computed(() => {
  return batchList.value.filter(b => {
    if (filterForm.carrier && b.carrier !== filterForm.carrier) return false
    if (filterForm.feeMonth && b.feeMonth !== filterForm.feeMonth) return false
    if (filterForm.status && b.status !== filterForm.status) return false
    return true
  })
})

// 重置筛选
function resetFilter() {
  filterForm.carrier = ''
  filterForm.feeMonth = ''
  filterForm.status = ''
}

// 跳转批次详情
async function goDetail(id: number) {
  await navigateTo(`/invoices/batches/${id}`)
}

// 生成计提表（跳转到生成页面）
function handleGenerateAccrual(row: any) {
  navigateTo(`/accruals/generate/${row.id}`)
}

// 批量删除
async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedBatches.value.length} 个批次吗？包含的发票将一并删除。`, '批量删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const ids = selectedBatches.value.map(b => b.id)
  await deleteBatches(ids)
  clearSelection()
  ElMessage.success(`已删除 ${ids.length} 个批次`)
}

// 删除批次
async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除批次 ${formatBatchNo(row)} 吗？包含 ${row.invoiceCount} 张发票将一并删除。`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteBatch(row.id)
  ElMessage.success('删除成功')
}
</script>

<style scoped>
.filter-card {
  margin-bottom: var(--spacing-card);
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.batch-no {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--color-primary);
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 10px 16px;
  margin-bottom: 12px;
  background: var(--bg-page);
  border-radius: var(--radius-sm);
}

.batch-info {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin-right: auto;
}

.empty-tip {
  padding: 40px 0;
}
</style>
