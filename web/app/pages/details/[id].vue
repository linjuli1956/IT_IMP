<template>
  <div class="page-container" v-loading="loading">
    <PageHeader :title="detail ? `${detail.carrier} ${detail.feeMonth} 明细表` : '明细表详情'">
      <template #actions>
        <el-button @click="navigateTo('/details')">返回列表</el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 明细表按 sheet 分 tab 展示，每个 sheet 对应一个门店的号码费用明细</p>
        <p>2. 列说明：业务号码 | 月基本费 | 语音通信费 | 短信彩信费 | 综合信息服务费 | 优惠费用 | 应收合计</p>
        <p>3. 生成计提表时，号码行直接取"应收合计"，非号码行用倒推计算（发票总额 - 号码行之和）</p>
        <p>4. 门店名自动匹配系统门店列表，未匹配的需手动关联</p>
      </div>
    </el-alert>

    <template v-if="detail">
      <!-- 明细表信息 -->
      <div class="card info-card">
        <el-descriptions :column="4" border>
          <el-descriptions-item label="运营商">{{ detail.carrier }}</el-descriptions-item>
          <el-descriptions-item label="费用月">{{ detail.feeMonth }}</el-descriptions-item>
          <el-descriptions-item label="文件名">{{ detail.fileName }}</el-descriptions-item>
          <el-descriptions-item label="上传时间">{{ detail.uploadTime }}</el-descriptions-item>
          <el-descriptions-item label="Sheet数">{{ detail.sheetCount }} 个</el-descriptions-item>
          <el-descriptions-item label="总号码数">{{ detail.totalNumbers }} 个</el-descriptions-item>
          <el-descriptions-item label="合计金额">
            <span class="amount-text">¥ {{ detail.totalAmount.toFixed(2) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="关联批次">
            <el-tag v-if="relatedBatches.length > 0" size="small" type="primary">
              {{ relatedBatches.length }} 个批次
            </el-tag>
            <span v-else class="text-secondary">暂无关联批次</span>
          </el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- Sheet Tab 展示 -->
      <div class="card">
        <div class="section-header">
          <span class="section-title">号码费用明细</span>
          <el-tag type="info">{{ detail.sheets.length }} 个 sheet</el-tag>
        </div>

        <el-tabs v-model="activeSheet" type="border-card">
          <el-tab-pane
            v-for="(sheet, idx) in detail.sheets"
            :key="idx"
            :label="sheet.sheetName"
            :name="String(idx)"
          >
            <!-- Sheet 汇总信息 -->
            <div class="sheet-summary">
              <span class="summary-item">
                门店：<el-tag size="small">{{ sheet.store }}</el-tag>
              </span>
              <span class="summary-item">号码数：{{ sheet.totalNumbers }} 个</span>
              <span class="summary-item">
                合计金额：<span class="amount-text">¥ {{ sheet.totalAmount.toFixed(2) }}</span>
              </span>
            </div>

            <!-- 号码费用表格 -->
            <el-table :data="sheet.rows" border stripe style="width: 100%" show-summary :summary-method="getSummary">
              <el-table-column type="index" label="序号" width="60" align="center" />
              <el-table-column prop="number" label="业务号码" min-width="140" />
              <el-table-column prop="monthlyFee" label="月基本费" width="110" align="right">
                <template #default="{ row }">
                  <span>{{ row.monthlyFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="voiceFee" label="语音通信费" width="120" align="right">
                <template #default="{ row }">
                  <span>{{ row.voiceFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="smsFee" label="短信彩信费" width="110" align="right">
                <template #default="{ row }">
                  <span>{{ row.smsFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="infoFee" label="综合信息服务费" width="130" align="right">
                <template #default="{ row }">
                  <span>{{ row.infoFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="discountFee" label="优惠费用" width="100" align="right">
                <template #default="{ row }">
                  <span :class="{ 'discount-text': row.discountFee < 0 }">{{ row.discountFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
              <el-table-column prop="totalFee" label="应收合计" width="120" align="right">
                <template #default="{ row }">
                  <span class="amount-text">¥ {{ row.totalFee.toFixed(2) }}</span>
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <div v-else class="card empty-tip">
      <el-empty description="明细表不存在或已删除">
        <el-button @click="navigateTo('/details')">返回列表</el-button>
      </el-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DetailTable } from '~/types/detail'

const route = useRoute()
const { fetchDetailById } = useDetailData()
const { batchList } = useInvoiceData()

const detailId = Number(route.params.id)
const detail = ref<DetailTable | null>(null)
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  detail.value = await fetchDetailById(detailId)
  loading.value = false
})

// 默认选中第一个 sheet
const activeSheet = ref('0')

// 查找关联的发票批次（同运营商同费用月）
const relatedBatches = computed(() => {
  if (!detail.value) return []
  return batchList.value.filter(b =>
    b.carrier === detail.value!.carrier && b.feeMonth === detail.value!.feeMonth
  )
})

// 合计行
function getSummary({ columns, data }: { columns: any[]; data: any[] }) {
  const sums: string[] = []
  columns.forEach((col, index) => {
    if (index === 0) {
      sums[index] = '合计'
      return
    }
    if (index === 1) {
      sums[index] = `${data.length} 个号码`
      return
    }
    const prop = col.property
    if (!prop) {
      sums[index] = ''
      return
    }
    const total = data.reduce((sum, row) => sum + (Number(row[prop]) || 0), 0)
    sums[index] = total.toFixed(2)
  })
  return sums
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

.sheet-summary {
  display: flex;
  gap: 24px;
  margin-bottom: var(--spacing-card);
  padding: 12px 16px;
  background: var(--bg-page);
  border-radius: var(--radius-card);
  font-size: var(--font-size-body);
  color: var(--text-regular);
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}

.discount-text {
  color: var(--color-danger);
}

.text-secondary {
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.empty-tip {
  padding: 40px 0;
}
</style>
