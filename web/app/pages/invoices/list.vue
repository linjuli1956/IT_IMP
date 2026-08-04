<template>
  <div class="page-container">
    <PageHeader title="发票列表">
      <template #actions>
        <el-button type="primary" :disabled="selectedInvoices.length === 0" @click="handleBatchPrint">
          <el-icon><Printer /></el-icon>
          批量打印（{{ selectedInvoices.length }}）
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 查看所有已上传的发票，支持按运营商、费用月、门店、关键词筛选</p>
        <p>2. 门店列用标签展示，一张发票可关联多个部门（多标签显示）</p>
        <p>3. 操作列支持：查看预览、下载原文件、打印（A5尺寸，2张/张A4）、删除</p>
        <p>4. 打印流程：点击"打印" → 预览 → 确认打印 → 自动弹打印对话框（A5排版已设好）→ 裁剪</p>
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
        <el-form-item label="门店">
          <el-select v-model="filterForm.store" placeholder="全部" clearable filterable style="width: 160px">
            <el-option v-for="opt in storeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filterForm.status" placeholder="全部" clearable style="width: 130px">
            <el-option label="已确认" value="ocr-confirmed" />
            <el-option label="OCR待确认" value="ocr-pending" />
            <el-option label="OCR失败" value="ocr-failed" />
            <el-option label="已上传" value="uploaded" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filterForm.keyword" placeholder="搜索文件名" clearable style="width: 200px" />
        </el-form-item>
        <el-form-item>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 发票表格 -->
    <div class="card">
      <!-- 批量操作栏 -->
      <div v-if="selectedInvoices.length > 0" class="batch-bar">
        <span class="batch-info">已选 {{ selectedInvoices.length }} 项</span>
        <el-button size="small" type="danger" @click="handleBatchDelete">批量删除</el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>
      <el-table
        ref="tableRef"
        :data="filteredInvoices"
        border
        stripe
        style="width: 100%"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="45" align="center" />
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="name" label="文件名" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <span class="invoice-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="carrier" label="运营商" width="110" />
        <el-table-column prop="feeMonth" label="费用月" width="100" align="center" />
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
            <el-tag :type="getStatusType(row.status)" size="small">
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="uploadTime" label="上传时间" width="150" align="center" />
        <el-table-column label="操作" width="280" fixed="right" align="center">
          <template #default="{ row }">
            <el-button size="small" @click="handleView(row)">查看</el-button>
            <el-button size="small" @click="handleDownload(row)">下载</el-button>
            <el-button size="small" @click="handlePrint(row)">打印</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="filteredInvoices.length === 0" class="empty-tip">
        <el-empty description="暂无发票数据" />
      </div>
    </div>

    <!-- 打印预览弹窗 -->
    <el-dialog v-model="printPreviewVisible" title="打印预览" width="720px" top="5vh" @close="printPreviewImages = []">
      <div class="print-preview">
        <div v-loading="rendering" class="preview-frame">
          <div v-for="(img, i) in printPreviewImages" :key="i" class="preview-page">
            <img :src="img" alt="发票预览" />
          </div>
        </div>
        <el-alert type="info" :closable="false" show-icon class="print-tips">
          <template #title>A5打印说明</template>
          <div class="print-tips-content">
            <p>发票为A5尺寸，2张A5排布在1张A4纸上，打印后对半裁剪使用。</p>
            <p>确认打印后将自动弹出打印对话框，A5排版已自动设置好，直接点打印即可。</p>
          </div>
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="printPreviewVisible = false">取消</el-button>
        <el-button type="primary" :disabled="rendering || printPreviewImages.length === 0" @click="confirmPrint">确认打印</el-button>
      </template>
    </el-dialog>

    <!-- 批量打印预览弹窗 -->
    <el-dialog v-model="batchPrintVisible" title="批量打印预览" width="720px" top="5vh" @close="batchPrintImages = []">
      <div class="print-preview">
        <div v-loading="rendering" class="preview-frame">
          <div v-for="(img, i) in batchPrintImages" :key="i" class="preview-page">
            <img :src="img" alt="发票预览" />
          </div>
        </div>
        <el-alert type="info" :closable="false" show-icon class="print-tips">
          <template #title>A5打印说明</template>
          <div class="print-tips-content">
            <p>共 {{ batchPrintImages.length }} 张发票，2张A5排布在1张A4纸上，打印后对半裁剪使用。</p>
            <p>确认打印后将自动弹出打印对话框，A5排版已自动设置好，直接点打印即可。</p>
          </div>
        </el-alert>
      </div>
      <template #footer>
        <el-button @click="batchPrintVisible = false">取消</el-button>
        <el-button type="primary" :disabled="rendering || batchPrintImages.length === 0" @click="confirmBatchPrint">确认打印</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Printer } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const { storeOptions } = useStoreData()
const { invoiceList, deleteInvoice, deleteInvoices, fetchInvoices, loading } = useInvoiceData()
const { renderPdfToImages, printImages } = usePdfPrint()

// 页面加载时获取发票列表
onMounted(() => {
  fetchInvoices()
})

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
  store: '',
  status: '',
  keyword: '',
})

// 表格引用
const tableRef = ref()
const selectedInvoices = ref<any[]>([])

// 打印预览
const printPreviewVisible = ref(false)
const printPreviewImages = ref<string[]>([])
const rendering = ref(false)
const batchPrintVisible = ref(false)
const batchPrintImages = ref<string[]>([])

// 筛选后的发票列表
const filteredInvoices = computed(() => {
  return invoiceList.value.filter(inv => {
    if (filterForm.carrier && inv.carrier !== filterForm.carrier) return false
    if (filterForm.feeMonth && inv.feeMonth !== filterForm.feeMonth) return false
    if (filterForm.store && !inv.stores.includes(filterForm.store)) return false
    if (filterForm.status && inv.status !== filterForm.status) return false
    if (filterForm.keyword && !inv.name.toLowerCase().includes(filterForm.keyword.toLowerCase())) return false
    return true
  })
})

// 选择变化
function handleSelectionChange(rows: any[]) {
  selectedInvoices.value = rows
}

// 重置筛选
function resetFilter() {
  filterForm.carrier = ''
  filterForm.feeMonth = ''
  filterForm.store = ''
  filterForm.status = ''
  filterForm.keyword = ''
}

// 状态文本
function getStatusText(status: string): string {
  const map: Record<string, string> = {
    'uploaded': '已上传',
    'ocr-pending': 'OCR待确认',
    'ocr-confirmed': '已确认',
    'ocr-failed': 'OCR失败',
    'pending': '待处理',
  }
  return map[status] || status
}

// 状态tag类型
function getStatusType(status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    'uploaded': 'info',
    'ocr-pending': 'warning',
    'ocr-confirmed': 'success',
    'ocr-failed': 'danger',
    'pending': 'warning',
  }
  return map[status] || 'info'
}

// 查看发票（新窗口打开PDF预览）
function handleView(row: any) {
  if (!row.filePath) {
    ElMessage.warning('该发票没有关联的PDF文件')
    return
  }
  window.open(row.filePath, '_blank')
}

// 下载发票
function handleDownload(row: any) {
  if (!row.filePath) {
    ElMessage.warning('该发票没有关联的PDF文件')
    return
  }
  const link = document.createElement('a')
  link.href = row.filePath
  link.download = row.name
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 单张打印（PDF.js渲染预览）
async function handlePrint(row: any) {
  if (!row.filePath) {
    ElMessage.warning('该发票没有关联的PDF文件')
    return
  }
  printPreviewVisible.value = true
  printPreviewImages.value = []
  rendering.value = true
  try {
    printPreviewImages.value = await renderPdfToImages(row.filePath)
  } catch(e) {
    ElMessage.error('PDF加载失败：' + (e as Error).message)
    printPreviewVisible.value = false
  } finally {
    rendering.value = false
  }
}

// 确认打印（HTML打印窗口，自动弹打印对话框）
function confirmPrint() {
  printPreviewVisible.value = false
  try {
    printImages(printPreviewImages.value)
  } catch(e) {
    ElMessage.error((e as Error).message)
  }
}

// 批量打印（打开弹窗并渲染PDF预览）
async function handleBatchPrint() {
  if (selectedInvoices.value.length === 0) {
    ElMessage.warning('请先勾选要打印的发票')
    return
  }
  batchPrintVisible.value = true
  batchPrintImages.value = []
  rendering.value = true
  try {
    const invoices = selectedInvoices.value.filter(inv => inv.filePath)
    for (const inv of invoices) {
      const images = await renderPdfToImages(inv.filePath)
      batchPrintImages.value.push(...images)
    }
  } catch(e) {
    ElMessage.error('PDF加载失败：' + (e as Error).message)
    batchPrintVisible.value = false
  } finally {
    rendering.value = false
  }
}

// 确认批量打印（使用已渲染的图片直接打印）
function confirmBatchPrint() {
  if (batchPrintImages.value.length === 0) return
  batchPrintVisible.value = false
  try {
    printImages(batchPrintImages.value)
  } catch(e) {
    ElMessage.error((e as Error).message)
  }
}

// 批量删除
async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedInvoices.value.length} 张发票吗？`, '批量删除', {
      confirmButtonText: '确定删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  const ids = selectedInvoices.value.map(inv => inv.id)
  await deleteInvoices(ids)
  clearSelection()
  ElMessage.success(`已删除 ${ids.length} 张发票`)
}

// 取消选择
function clearSelection() {
  tableRef.value?.clearSelection()
  selectedInvoices.value = []
}

// 删除发票
async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除发票"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }
  await deleteInvoice(row.id)
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

.invoice-name {
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.store-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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

.print-preview {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-card);
}

.preview-frame {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  overflow: auto;
  max-height: 450px;
}

.preview-page {
  text-align: center;
  padding: 8px;
}

.preview-page img {
  max-width: 100%;
  height: auto;
}

.print-tips-content p {
  margin: 4px 0;
  line-height: 1.6;
}

.empty-tip {
  padding: 40px 0;
}
</style>
