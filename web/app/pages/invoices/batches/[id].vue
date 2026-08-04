<template>
  <div class="page-container">
    <PageHeader :title="`批次详情 ${formatBatchNo(batch)}`">
      <template #actions>
        <el-button @click="navigateTo('/invoices/batches')">返回批次列表</el-button>
        <el-button
          v-if="existingAccrual"
          @click="navigateTo(`/accruals/${existingAccrual.id}`)"
        >查看计提表</el-button>
        <el-button
          v-if="!batch || batch.status === 'pending'"
          type="primary"
          :disabled="!batch"
          @click="handleGenerateAccrual"
        >生成计提表</el-button>
        <el-button
          v-else
          type="primary"
          @click="handleGenerateAccrual"
        >再次生成计提表</el-button>
      </template>
    </PageHeader>

    <template v-if="batch">
      <!-- 批次信息 -->
      <div class="card batch-info-card" v-loading="loading">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="批次号">{{ formatBatchNo(batch) }}</el-descriptions-item>
          <el-descriptions-item label="运营商">{{ batch.carrier }}</el-descriptions-item>
          <el-descriptions-item label="费用月">{{ batch.feeMonth }}</el-descriptions-item>
          <el-descriptions-item label="门店/机构">{{ batch.store }}</el-descriptions-item>
          <el-descriptions-item label="发票数量">{{ batch.invoiceCount }} 张</el-descriptions-item>
          <el-descriptions-item label="合计金额">
            <span class="amount-highlight">¥ {{ batch.totalAmount.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getBatchStatusType(batch.status)" size="small">
              {{ getBatchStatusText(batch.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ batch.createTime }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 发票列表 -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">发票列表</span>
          <el-tag type="info">{{ batch.invoices.length }} 张</el-tag>
        </div>

        <el-table :data="batch.invoices" border stripe style="width: 100%">
          <el-table-column type="index" label="序号" width="60" align="center" />
          <el-table-column prop="name" label="文件名" min-width="280" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="invoice-name">{{ row.name }}</span>
            </template>
          </el-table-column>
          <el-table-column label="门店/机构" min-width="180">
            <template #default="{ row }">
              <div class="store-tags">
                <el-tag v-for="s in row.stores" :key="s" size="small" type="info">{{ s }}</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="金额" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-text">¥ {{ (row.amount || 0).toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag type="success" size="small">已确认</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="uploadTime" label="上传时间" width="150" align="center" />
        </el-table>
      </div>

      <!-- 报销说明预览 -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">报销说明（预览）</span>
          <el-button size="small" @click="copyReimbursement">
            <el-icon><CopyDocument /></el-icon>
            复制
          </el-button>
        </div>
        <div class="reimbursement-text">{{ reimbursementText }}</div>
        <div class="reimbursement-hint">
          此为自动生成的报销说明预览，实际报销说明在计提模板中配置，生成计提表后以模板配置为准。
        </div>
      </div>
    </template>

    <!-- 加载中 -->
    <div v-if="loading && !batch" class="card not-found-card">
      <el-empty description="加载中..." />
    </div>

    <!-- 批次不存在 -->
    <div v-else-if="!batch" class="card not-found-card">
      <el-empty description="批次不存在或已被删除">
        <el-button type="primary" @click="navigateTo('/invoices/batches')">返回批次列表</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CopyDocument } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const route = useRoute()
const { fetchBatchById, getBatchStatusText, getBatchStatusType, formatBatchNo } = useInvoiceData()
const { getAccrualByBatchId } = useAccrualData()

const batchId = Number(route.params.id)
const batch = ref<any>(null)
const loading = ref(false)

// 加载批次详情
onMounted(async () => {
  loading.value = true
  batch.value = await fetchBatchById(batchId)
  loading.value = false
})

// 检查是否已生成计提表
const existingAccrual = computed(() => getAccrualByBatchId(batchId))

// 报销说明预览（简单格式，实际以计提模板配置为准）
const reimbursementText = computed(() => {
  if (!batch.value) return ''
  const b = batch.value
  const amountStr = b.totalAmount.toFixed(2)
  return `${b.feeMonth}${b.carrier}${b.store}费用：${amountStr}元`
})

// 复制报销说明
async function copyReimbursement() {
  try {
    await navigator.clipboard.writeText(reimbursementText.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请手动选择文本复制')
  }
}

// 生成计提表
function handleGenerateAccrual() {
  navigateTo(`/accruals/generate/${batchId}`)
}
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

.amount-highlight {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--color-primary);
}

.invoice-name {
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}

.store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.reimbursement-text {
  padding: var(--spacing-card);
  background: var(--bg-page);
  border-radius: var(--radius-input);
  border: 1px dashed var(--border-base);
  font-size: var(--font-size-body);
  color: var(--text-primary);
  line-height: 1.8;
}

.reimbursement-hint {
  margin-top: var(--spacing-btn-gap);
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
}

.not-found-card {
  padding: 60px 0;
}
</style>
