<template>
  <div class="page-container">
    <PageHeader title="明细表管理" subtitle="电信号码费用明细" description="目前仅电信有明细表（XLS格式），多 sheet 结构按门店分 sheet；明细表绑定运营商+费用月，生成计提表时按运营商+费用月自动匹配" />

    <!-- 上传区（仅管理员/操作员） -->
    <div v-if="canWrite" class="card upload-card">
      <div class="section-header">
        <span class="section-title">上传明细表</span>
      </div>
      <el-form :inline="true" :model="uploadForm" class="upload-form">
        <el-form-item label="运营商" required>
          <el-select v-model="uploadForm.carrier" placeholder="请选择运营商" style="width: 140px">
            <el-option v-for="opt in carrierOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="费用月" required>
          <el-date-picker
            v-model="uploadForm.feeMonth"
            type="month"
            placeholder="选择费用月"
            format="YYYY-MM"
            value-format="YYYY-MM"
            style="width: 150px"
          />
        </el-form-item>
      </el-form>
      <DragUpload
        ref="dragUploadRef"
        :max-count="1"
        accept=".xls,.xlsx"
        hint-text="将 XLS 文件拖拽到此处，或点击选择"
        sub-hint="支持 XLS、XLSX 格式，单次上传1个文件"
        @files-change="onFilesChange"
      />
      <div class="upload-actions">
        <el-button
          type="primary"
          :disabled="!canUpload"
          :loading="uploading"
          @click="handleUpload"
        >确认上传</el-button>
        <span v-if="!canUpload" class="upload-hint">请选择运营商、费用月并添加文件</span>
      </div>
    </div>

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
        <el-form-item>
          <el-button @click="resetFilter">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <!-- 明细表表格 -->
    <div class="card">
      <CrudTable
        v-if="loading || filteredDetails.length > 0"
        :columns="columns"
        :data="filteredDetails"
        :loading="loading"
        :show-selection="canWrite"
        :show-batch-delete="canWrite"
        :action-width="130"
        @batch-delete="handleBatchDelete"
      >
        <template #sheetCount="{ row }">
          <el-tag size="small" type="info">{{ row.sheetCount }}个</el-tag>
        </template>
        <template #totalAmount="{ row }">
          <span class="amount-text">¥ {{ row.totalAmount.toFixed(2) }}</span>
        </template>
        <template #actions="{ row }">
          <el-button size="small" text @click="goDetail(row.id)">详情</el-button>
          <el-button v-if="canWrite" size="small" text type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>

      <EmptyState
        v-else
        description="暂无明细表数据"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'

const { detailList, loading, fetchDetails, uploadDetail, deleteDetail, findByCarrierMonth } = useDetailData()

// 权限：上传/删除明细表需管理员/操作员（对齐 /api/details POST、/api/details/:id DELETE）
const canWrite = ref(false)

// 页面加载时获取数据
onMounted(() => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canWrite.value = role === '管理员' || role === '操作员'
    } catch { canWrite.value = false }
  }
  fetchDetails()
})

// 表格列定义
const columns = [
  { prop: 'carrier', label: '运营商', width: 110 },
  { prop: 'feeMonth', label: '费用月', width: 100, align: 'center' as const },
  { prop: 'fileName', label: '文件名', minWidth: 220 },
  { prop: 'sheetCount', label: 'Sheet数', width: 90, align: 'center' as const, slot: 'sheetCount' },
  { prop: 'totalNumbers', label: '号码数', width: 90, align: 'center' as const },
  { prop: 'totalAmount', label: '合计金额', width: 130, align: 'right' as const, slot: 'totalAmount' },
  { prop: 'uploadTime', label: '上传时间', width: 150, align: 'center' as const },
]

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
})

// 筛选后的明细表列表
const filteredDetails = computed(() => {
  return detailList.value.filter(d => {
    if (filterForm.carrier && d.carrier !== filterForm.carrier) return false
    if (filterForm.feeMonth && d.feeMonth !== filterForm.feeMonth) return false
    return true
  })
})

// 重置筛选
function resetFilter() {
  filterForm.carrier = ''
  filterForm.feeMonth = ''
}

// 跳转明细表详情
async function goDetail(id: number) {
  await navigateTo(`/details/${id}`)
}

// 批量删除（CrudTable 已确认）
async function handleBatchDelete(rows: any[]) {
  const ids = rows.map(d => d.id)
  for (const id of ids) {
    await deleteDetail(id)
  }
  ElMessage.success(`已删除 ${ids.length} 张明细表`)
}

// 删除明细表
function handleDelete(row: any) {
  ElMessageBox.confirm(`确定要删除 ${row.carrier} ${row.feeMonth} 的明细表吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    await deleteDetail(row.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

// === 上传区 ===
const uploading = ref(false)
const dragUploadRef = ref()
const uploadFiles = ref<any[]>([])

const uploadForm = reactive({
  carrier: '中国电信',
  feeMonth: '',
})

const canUpload = computed(() => {
  return uploadForm.carrier && uploadForm.feeMonth && uploadFiles.value.length > 0
})

function onFilesChange(files: any[]) {
  uploadFiles.value = files
}

function handleUpload() {
  // 检查是否已存在同运营商同月的明细表
  const existing = findByCarrierMonth(uploadForm.carrier, uploadForm.feeMonth)
  if (existing) {
    ElMessageBox.confirm(
      `${uploadForm.carrier} ${uploadForm.feeMonth} 已存在明细表，是否覆盖？`,
      '提示',
      { confirmButtonText: '覆盖', cancelButtonText: '取消', type: 'warning' }
    ).then(async () => {
      if (existing.id) {
        await deleteDetail(existing.id)
      }
      doUpload()
    }).catch(() => {})
  } else {
    doUpload()
  }
}

async function doUpload() {
  uploading.value = true
  const file = uploadFiles.value[0]
  if (!file?.raw) {
    ElMessage.error('文件读取失败，请重新选择')
    uploading.value = false
    return
  }

  const formData = new FormData()
  formData.append('file', file.raw)
  formData.append('carrier', uploadForm.carrier)
  formData.append('feeMonth', uploadForm.feeMonth)

  const detail = await uploadDetail(formData)
  uploading.value = false

  if (detail) {
    // 清空上传区
    uploadFiles.value = []
    uploadForm.feeMonth = ''
    dragUploadRef.value?.clear()
    ElMessage.success(`明细表上传成功，解析出 ${detail.sheetCount} 个 sheet，共 ${detail.totalNumbers} 个号码`)
  }
}
</script>

<style scoped>
.filter-card {
  margin-bottom: var(--spacing-card);
}

.upload-card {
  margin-bottom: var(--spacing-card);
}

.section-header {
  margin-bottom: var(--spacing-card);
}

.section-title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--text-primary);
}

.upload-form {
  margin-bottom: var(--spacing-card);
}

.upload-actions {
  margin-top: var(--spacing-card);
  display: flex;
  align-items: center;
  gap: 12px;
}

.upload-hint {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.amount-text {
  font-weight: 600;
  color: var(--text-primary);
}
</style>
