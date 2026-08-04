<template>
  <div class="page-container">
    <PageHeader title="上传发票">
      <template #actions>
        <el-button @click="navigateTo('/invoices/batches')">返回批次列表</el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 按步骤操作：填写信息 → 上传并OCR识别 → 确认发票信息 → 完成</p>
        <p>2. 支持PDF/ZIP格式拖拽上传，ZIP自动解压为多张PDF并逐个OCR</p>
        <p>3. OCR自动提取发票号码、日期、销售方、金额，可手动修正</p>
        <p>4. OCR失败的发票字段为空，可在确认表格中手动录入</p>
        <p>5. 确认后发票状态变为已确认，可在批次列表中查看</p>
      </div>
    </el-alert>

    <div class="upload-page">
      <!-- 步骤指引 -->
      <el-steps :active="activeStep" align-center class="steps">
        <el-step title="填写信息" description="选运营商/费用月/门店" />
        <el-step title="上传并OCR识别" description="拖拽PDF/ZIP文件" />
        <el-step title="确认发票信息" description="核对并修正OCR结果" />
        <el-step title="完成" description="发票已归档" />
      </el-steps>

      <!-- 步骤1+2: 填写信息 + 上传 -->
      <div v-if="activeStep <= 1" class="card upload-section">
        <div class="section-header">
          <span class="section-title">上传信息</span>
        </div>

        <el-form :model="uploadForm" label-width="100px" class="upload-form">
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="运营商" required>
                <el-select v-model="uploadForm.carrier" placeholder="请选择运营商" style="width: 100%">
                  <el-option v-for="opt in carrierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="费用月" required>
                <el-date-picker
                  v-model="uploadForm.feeMonth"
                  type="month"
                  placeholder="选择费用月"
                  format="YYYY-MM"
                  value-format="YYYY-MM"
                  style="width: 100%"
                />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="门店/机构" required>
                <el-select
                  v-model="uploadForm.stores"
                  multiple
                  placeholder="请选择门店或机构（可多选）"
                  filterable
                  style="width: 100%"
                >
                  <el-option v-for="opt in storeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>

        <el-divider />

        <DragUpload ref="dragUploadRef" :max-count="10" @files-change="onFilesChange" />

        <div class="upload-actions">
          <el-button
            type="primary"
            size="large"
            :disabled="!canStartOcr"
            :loading="uploading"
            @click="startOcr"
          >
            <el-icon v-if="!uploading"><MagicStick /></el-icon>
            {{ uploading ? '正在上传并OCR识别...' : '上传并OCR识别' }}
          </el-button>
          <span v-if="!canStartOcr" class="upload-hint">请填写完整信息并添加至少1个文件</span>
        </div>
      </div>

      <!-- 步骤3: OCR确认 -->
      <div v-if="activeStep === 2" class="card ocr-section">
        <div class="section-header">
          <span class="section-title">OCR识别结果确认</span>
          <el-tag type="info">共 {{ ocrResults.length }} 张发票</el-tag>
        </div>

        <el-table :data="ocrResults" border style="width: 100%" :row-class-name="getRowClassName">
          <el-table-column label="序号" width="60" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.ocrFailed" type="danger" size="small">OCR失败</el-tag>
              <el-tag v-else-if="row.confidence >= 0.8" type="success" size="small">可信</el-tag>
              <el-tag v-else-if="row.confidence > 0" type="warning" size="small">部分</el-tag>
              <el-tag v-else type="info" size="small">待录入</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="原文件名" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">{{ row.fileName }}</template>
          </el-table-column>
          <el-table-column label="发票号码" width="180">
            <template #default="{ row }">
              <el-input v-model="row.invoiceNumber" size="small" placeholder="发票号码" />
            </template>
          </el-table-column>
          <el-table-column label="开票日期" width="150">
            <template #default="{ row }">
              <el-input v-model="row.invoiceDate" size="small" placeholder="YYYY-MM-DD" />
            </template>
          </el-table-column>
          <el-table-column label="销售方" min-width="180">
            <template #default="{ row }">
              <el-input v-model="row.sellerName" size="small" placeholder="销售方名称" />
            </template>
          </el-table-column>
          <el-table-column label="购买方" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="readonly-text">{{ row.buyerName || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="金额来源" width="110" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.amountSource && row.amountSource !== '未识别'" type="info" size="small">
                {{ row.amountSource }}
              </el-tag>
              <span v-else class="readonly-text">—</span>
            </template>
          </el-table-column>
          <el-table-column label="价税合计" width="140" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.amount"
                :precision="2"
                :min="0"
                :controls="false"
                size="small"
                style="width: 110px"
              />
            </template>
          </el-table-column>
          <el-table-column label="门店/机构" min-width="180">
            <template #default="{ row }">
              <el-select v-model="row.stores" multiple collapse-tags collapse-tags-tooltip size="small" style="width: 100%" placeholder="选择部门">
                <el-option v-for="s in uploadForm.stores" :key="s" :label="s" :value="s" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" align="center">
            <template #default="{ $index }">
              <el-button text type="danger" size="small" @click="removeOcrItem($index)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="ocr-summary">
          <div class="summary-item">
            <span class="summary-label">发票数量：</span>
            <span class="summary-value">{{ ocrResults.length }} 张</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">价税合计：</span>
            <span class="summary-value highlight">{{ totalAmount.toFixed(2) }} 元</span>
          </div>
          <div class="summary-item" v-if="failedCount > 0">
            <span class="summary-label">OCR失败：</span>
            <span class="summary-value" style="color: var(--color-danger);">{{ failedCount }} 张</span>
          </div>
        </div>

        <div class="ocr-actions">
          <el-button @click="activeStep = 1">返回修改</el-button>
          <el-button type="primary" size="large" :loading="creating" @click="handleConfirm">
            <el-icon><Check /></el-icon>
            确认发票信息
          </el-button>
        </div>
      </div>

      <!-- 步骤4: 创建成功 -->
      <div v-if="activeStep === 3" class="card success-section">
        <el-result icon="success" title="发票确认成功" :sub-title="successMessage">
          <template #extra>
            <el-button type="primary" @click="navigateTo('/invoices/batches')">查看批次列表</el-button>
            <el-button @click="resetAll">继续上传</el-button>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { MagicStick, Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { OcrResult } from '~/types/invoice'

const { storeOptions } = useStoreData()
const { createBatch: createNewBatch, uploadInvoices, confirmInvoices, formatBatchNo } = useInvoiceData()

// 运营商选项
const carrierOptions = [
  { label: '中国电信', value: '中国电信' },
  { label: '中国联通', value: '中国联通' },
  { label: '中国移动', value: '中国移动' },
  { label: '广西广电', value: '广西广电' },
]

// 当前步骤
const activeStep = ref(0)

// 上传表单
const uploadForm = reactive({
  carrier: '',
  feeMonth: '',
  stores: [] as string[],
})

// 拖拽上传组件引用
const dragUploadRef = ref()

// 当前文件列表
const currentFiles = ref<{ name: string; size: number; raw?: File }[]>([])

// 上传中状态
const uploading = ref(false)

// OCR结果 — 扩展字段
interface OcrResultRow {
  id: number          // 发票记录ID（服务端返回）
  fileName: string
  carrier: string
  feeMonth: string
  stores: string[]
  amount: number
  invoiceNumber: string
  invoiceDate: string
  sellerName: string
  buyerName: string
  amountSource: string
  confidence: number
  ocrFailed: boolean
}

const ocrResults = ref<OcrResultRow[]>([])

// 创建中状态
const creating = ref(false)

// 成功消息
const successMessage = ref('')

// 是否可以开始OCR
const canStartOcr = computed(() => {
  return uploadForm.carrier &&
         uploadForm.feeMonth &&
         uploadForm.stores.length > 0 &&
         currentFiles.value.length > 0 &&
         !uploading.value
})

// 总金额
const totalAmount = computed(() =>
  ocrResults.value.reduce((sum, r) => sum + (r.amount || 0), 0)
)

// OCR失败数量
const failedCount = computed(() =>
  ocrResults.value.filter(r => r.ocrFailed).length
)

// 文件变化回调
function onFilesChange(files: { name: string; size: number; raw?: File }[]) {
  currentFiles.value = files
  if (files.length > 0) {
    activeStep.value = 1
  } else {
    activeStep.value = 0
  }
}

// 开始上传并OCR识别
async function startOcr() {
  if (!canStartOcr.value) return

  uploading.value = true
  try {
    // 1. 创建批次记录
    const batch = await createNewBatch({
      carrier: uploadForm.carrier,
      feeMonth: uploadForm.feeMonth,
      store: uploadForm.stores.join('、'),
    })

    if (!batch) {
      uploading.value = false
      return
    }

    // 2. 构建 FormData（files + batchId，不需要 metadata）
    const formData = new FormData()
    formData.append('batchId', String(batch.id))

    for (const file of currentFiles.value) {
      if (file.raw) {
        formData.append('files', file.raw, file.name)
      }
    }

    // 3. 上传文件 → 服务端自动 OCR
    const result = await uploadInvoices(formData)

    if (!result) {
      uploading.value = false
      return
    }

    // 4. 将服务端返回的 OCR 结果填入确认表格
    //    默认使用上传表单中选择的所有门店（多选）
    const defaultStores = [...uploadForm.stores]
    ocrResults.value = result.invoices.map((inv: any): OcrResultRow => {
      const ocr: OcrResult | undefined = inv.ocrResult
      return {
        id: inv.id,
        fileName: inv.name,
        carrier: inv.carrier,
        feeMonth: inv.feeMonth,
        stores: (inv.stores && inv.stores.length > 0) ? inv.stores : [...defaultStores],
        amount: Number(inv.amount) || 0,
        invoiceNumber: inv.invoiceNumber || ocr?.invoiceNumber || '',
        invoiceDate: inv.invoiceDate || ocr?.invoiceDate || '',
        sellerName: inv.sellerName || ocr?.sellerName || '',
        buyerName: ocr?.buyerName || '',
        amountSource: ocr?.amountSource || '未识别',
        confidence: ocr?.confidence || 0,
        ocrFailed: inv.status === 'ocr-failed',
      }
    })

    activeStep.value = 2
    const successCount = ocrResults.value.filter(r => !r.ocrFailed).length
    const failCount = ocrResults.value.filter(r => r.ocrFailed).length
    if (failCount > 0) {
      ElMessage.warning(`OCR识别完成：${successCount}张成功，${failCount}张失败（需手动录入）`)
    } else {
      ElMessage.success(`OCR识别完成，共识别 ${ocrResults.value.length} 张发票`)
    }
  } finally {
    uploading.value = false
  }
}

// 行样式：OCR失败的行高亮
function getRowClassName({ row }: { row: OcrResultRow }): string {
  return row.ocrFailed ? 'ocr-failed-row' : ''
}

// 移除OCR项
function removeOcrItem(index: number) {
  ocrResults.value.splice(index, 1)
  if (ocrResults.value.length === 0) {
    activeStep.value = 1
  }
}

// 确认发票信息（不再上传文件，文件已在 startOcr 时上传）
async function handleConfirm() {
  if (ocrResults.value.length === 0) {
    ElMessage.warning('没有可确认的发票')
    return
  }

  // 校验必填字段
  for (const row of ocrResults.value) {
    if (!row.amount || row.amount <= 0) {
      ElMessage.warning(`发票「${row.fileName}」金额不能为0，请填写`)
      return
    }
    if (row.stores.length === 0) {
      ElMessage.warning(`发票「${row.fileName}」未选择门店，请选择`)
      return
    }
  }

  creating.value = true
  try {
    const result = await confirmInvoices({
      invoices: ocrResults.value.map(r => ({
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        invoiceDate: r.invoiceDate,
        sellerName: r.sellerName,
        amount: r.amount,
        stores: r.stores,
      })),
    })

    if (!result || !result.batch) {
      creating.value = false
      return
    }

    // 显示成功
    const batchNo = formatBatchNo(result.batch)
    successMessage.value = `批次 ${batchNo} 已确认，包含 ${result.batch.invoiceCount} 张发票，合计 ${Number(result.batch.totalAmount).toFixed(2)} 元`
    activeStep.value = 3
    ElMessage.success('发票确认成功')
  } finally {
    creating.value = false
  }
}

// 重置全部
function resetAll() {
  activeStep.value = 0
  uploadForm.carrier = ''
  uploadForm.feeMonth = ''
  uploadForm.stores = []
  currentFiles.value = []
  ocrResults.value = []
  successMessage.value = ''
  dragUploadRef.value?.clear()
}
</script>

<style scoped>
.upload-page {
  width: 100%;
}

.steps {
  margin-bottom: 24px;
}

.upload-section,
.ocr-section,
.success-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.upload-form {
  margin-bottom: 8px;
}

.upload-actions {
  margin-top: 20px;
  text-align: center;
}

.upload-hint {
  margin-left: var(--spacing-btn-gap);
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.readonly-text {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.ocr-summary {
  display: flex;
  gap: var(--spacing-page);
  padding: var(--spacing-card) var(--spacing-page);
  margin-top: var(--spacing-card);
  background: var(--bg-page);
  border-radius: var(--radius-card);
}

.summary-label {
  font-size: var(--font-size-body);
  color: var(--text-secondary);
}

.summary-value {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--text-primary);
}

.summary-value.highlight {
  color: var(--color-primary);
}

.ocr-actions {
  margin-top: var(--spacing-page);
  text-align: center;
  display: flex;
  justify-content: center;
  gap: var(--spacing-btn-gap);
}

:deep(.ocr-failed-row) {
  background: var(--el-color-danger-light-9) !important;
}
</style>
