<template>
  <div class="page-container">
    <PageHeader
      title="电子称管理"
      subtitle="门店电子称台账"
      :description="`管理门店电子称（量程/精度/校准），按门店归属。校准提醒以「下次校准日期」为准。仅管理员与操作员可编辑。`"
    >
      <template #actions>
        <el-button v-if="canEdit" @click="handleExportCsv">
          <el-icon><Download /></el-icon>
          导出当前页 CSV
        </el-button>
        <el-button v-if="canEdit" type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          新增电子称
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <AssetFilters
        :fields="filterFields"
        :keyword="{ key: 'keyword', placeholder: '搜索品牌/型号/资产编号/位置' }"
        :model="filters"
        @update="handleFilterChange"
      />
    </div>

    <div class="card">
      <AssetTable
        :columns="columns"
        :data="scaleList"
        :total="total"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :error="error"
        :can-edit="canEdit"
        :row-clickable="true"
        @page-change="handlePageChange"
        @row-click="(row: any) => openDrawer(row)"
        @edit="(row: any) => handleEdit(row)"
        @delete="(row: any) => handleDelete(row)"
      >
        <template #name="{ row }">
          <RecordPreviewTooltip :title="formatName(row as ScaleItem)" :rows="buildScalePreviewRows(row as ScaleItem)">
            <template #reference>
              <span class="scale-name" tabindex="0" :aria-label="`预览电子称 ${formatName(row as ScaleItem)}`">{{ formatName(row as ScaleItem) }}</span>
            </template>
          </RecordPreviewTooltip>
        </template>
        <template #nextCalibrationDate="{ row }">
          <el-tag :type="calibrationTagType(row as ScaleItem)" size="small">{{ getCalibrationInfo((row as ScaleItem).nextCalibrationDate, (row as ScaleItem).status).label }}</el-tag>
        </template>
        <template #storeName="{ row }">{{ row.storeName || '-' }}</template>
      </AssetTable>
    </div>

    <AssetFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="formFields"
      :model="currentForm"
      :saving="saving"
      @submit="handleSubmit"
    />

    <!-- 详情抽屉 -->
    <AssetDetailDrawer v-model="drawerVisible" :title="drawerTitle" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ currentRow?.storeName || '—' }}</span>
        <el-tag :type="getAssetStatusTagType(currentRow?.status || '')" size="small">{{ currentRow?.status }}</el-tag>
      </template>
      <el-descriptions v-if="currentRow" :column="2" border size="small">
        <el-descriptions-item v-for="f in drawerItems" :key="f.label" :label="f.label" :span="f.span || 1">
          <span class="drawer-field">
            {{ f.value }}
            <el-button v-if="f.copyable && f.value !== '—'" class="drawer-copy-btn" text size="small" :aria-label="`复制${f.label}`" @click="copyField(f.value, f.label)">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </span>
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button v-if="canEdit" type="primary" @click="handleEditFromDrawer">编辑</el-button>
        <el-button v-if="canEdit" type="danger" @click="handleDeleteFromDrawer">删除</el-button>
      </template>
    </AssetDetailDrawer>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CopyDocument, Download } from '@element-plus/icons-vue'
import { useScaleData, scaleInterfaceOptions, scaleCalibrationOptions } from '~/composables/useScaleData'
import { useStoreData } from '~/composables/useStoreData'
import { getApiErrorMessage } from '~/composables/useApi'
import { buildScalePreviewRows } from '~/utils/preview-utils'
import { assetStatusOptions, getAssetStatusTagType, getCalibrationInfo } from '~/utils/asset-utils'
import { useClipboard } from '~/composables/useClipboard'
import { exportCurrentPageCsv, type CsvColumn } from '~/utils/csv-export'
import type { AssetFilterField, AssetFilterOption } from '~/components/asset/AssetFilters.vue'
import type { AssetFieldConfig } from '~/components/asset/AssetFormDialog.vue'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'
import type { ScaleItem } from '~/types/scale'

const {
  scaleList, total, loading, page, pageSize, error,
  fetchScales, addScale, updateScale, deleteScale,
} = useScaleData()
const { storeList } = useStoreData()

const canEdit = ref(false)
interface ScaleFilters {
  keyword?: string
  status?: string
  storeId?: number
  calibration?: string
}
const filters = reactive<ScaleFilters>({})

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchScales()
})

const storeIdOptions = computed<AssetFilterOption[]>(() => storeList.value.map(s => ({ label: s.name, value: s.id })))
const filterFields = computed<AssetFilterField<ScaleFilters>[]>(() => [
  { key: 'calibration', label: '校准状态', options: scaleCalibrationOptions },
  { key: 'status', label: '状态', options: assetStatusOptions },
  { key: 'storeId', label: '门店', options: storeIdOptions.value },
])

function handleFilterChange(patch: Record<string, any>) {
  Object.assign(filters, patch)
  // 联动约束：选校准状态 → 强制 status=正常；选停用/报废 → 清空校准状态（避免后端 400）
  if (filters.calibration && filters.status && filters.status !== '正常') {
    filters.calibration = undefined
  }
  if (filters.calibration) {
    filters.status = '正常'
  }
  fetchScales({ page: 1, ...filters })
}
function handlePageChange(p: number, s: number) {
  fetchScales({ page: p, pageSize: s, ...filters })
}

const columns: AssetColumn<ScaleItem>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 170, slot: 'name' },
  { key: 'storeName', label: '门店', width: 130, slot: 'storeName' },
  { key: 'assetNo', label: '资产编号', width: 110, copyable: true },
  { key: 'capacityKg', label: '量程(kg)', width: 90, align: 'center' as const },
  { key: 'precisionG', label: '精度(g)', width: 90, align: 'center' as const },
  { key: 'interface', label: '接口', width: 90, align: 'center' as const },
  { virtual: true, key: 'nextCalibrationDate', label: '下次校准', width: 130, align: 'center' as const, slot: 'nextCalibrationDate' },
  { key: 'installLocation', label: '位置', minWidth: 120, copyable: true },
  { key: 'status', label: '状态', width: 80, align: 'center' as const, type: 'status' as const },
]

const dialogVisible = ref(false)
const dialogTitle = ref('新增电子称')
const saving = ref(false)
const currentForm = ref<Partial<ScaleItem>>({})

const formFields = computed<AssetFieldConfig<ScaleItem>[]>(() => [
  { key: 'storeId', label: '门店', type: 'select', required: true, options: storeIdOptions.value, width: 'half', placeholder: '选择门店' },
  { key: 'assetNo', label: '资产编号', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'brand', label: '品牌', type: 'input', width: 'half', placeholder: '寺冈/顶尖/大华等', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'model', label: '型号', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'serialNo', label: '序列号', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'capacityKg', label: '量程(kg)', type: 'number', min: 0, precision: 2, width: 'half' },
  { key: 'precisionG', label: '精度(g)', type: 'number', min: 0, precision: 2, width: 'half' },
  { key: 'interface', label: '接口', type: 'select', options: scaleInterfaceOptions, width: 'half' },
  { key: 'lastCalibrationDate', label: '上次校准', type: 'date', width: 'half' },
  { key: 'nextCalibrationDate', label: '下次校准', type: 'date', width: 'half', tip: '校准提醒依据' },
  { key: 'calibrationCycleDays', label: '校准周期(天)', type: 'number', min: 0, precision: 0, width: 'half' },
  { key: 'installLocation', label: '安装位置', type: 'input', width: 'half', placeholder: '如 收银台3号', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'status', label: '状态', type: 'select', required: true, options: assetStatusOptions, width: 'half' },
  { key: 'remark', label: '备注', type: 'textarea', width: 'full' },
])

function calibrationTagType(row: ScaleItem): 'danger' | 'warning' | 'info' | 'success' {
  const tone = getCalibrationInfo(row.nextCalibrationDate, row.status).tone
  if (tone === 'danger') return 'danger'
  if (tone === 'warning') return 'warning'
  return 'success'
}

function formatName(row: ScaleItem): string {
  const parts = [row.brand, row.model].filter(Boolean)
  return parts.length ? parts.join(' ') : (row.assetNo || `电子称#${row.id}`)
}

function openAdd() {
  dialogTitle.value = '新增电子称'
  currentForm.value = {}
  dialogVisible.value = true
}

function handleEdit(row: ScaleItem) {
  dialogTitle.value = '编辑电子称'
  currentForm.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit(payload: Partial<ScaleItem>) {
  saving.value = true
  try {
    const id = currentForm.value.id
    if (id) {
      await updateScale(id, payload)
      ElMessage.success('编辑成功')
    } else {
      await addScale(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchScales({ page: id ? page.value : 1, ...filters })
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: ScaleItem) {
  try {
    await ElMessageBox.confirm(`确定要删除电子称"${formatName(row)}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteScale(row.id)
    ElMessage.success('删除成功')
    fetchScales({ page: 1, ...filters })
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(getApiErrorMessage(e))
  }
}

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const currentRow = ref<ScaleItem | null>(null)
function openDrawer(row: ScaleItem) {
  currentRow.value = row
  drawerVisible.value = true
}
function handleEditFromDrawer() {
  if (currentRow.value) {
    drawerVisible.value = false
    handleEdit(currentRow.value)
  }
}
function handleDeleteFromDrawer() {
  if (currentRow.value) {
    drawerVisible.value = false
    handleDelete(currentRow.value)
  }
}
const drawerTitle = computed(() => {
  if (!currentRow.value) return '电子称详情'
  return formatName(currentRow.value)
})
const drawerItems = computed<{ label: string; value: string; span?: number; copyable?: boolean }[]>(() => {
  const r = currentRow.value
  if (!r) return []
  const calInfo = getCalibrationInfo(r.nextCalibrationDate, r.status)
  return [
    { label: '名称', value: formatName(r), copyable: true },
    { label: '门店', value: r.storeName || '—' },
    { label: '资产编号', value: r.assetNo || '—', copyable: true },
    { label: '序列号', value: r.serialNo || '—', copyable: true },
    { label: '品牌', value: r.brand || '—', copyable: true },
    { label: '型号', value: r.model || '—', copyable: true },
    { label: '量程(kg)', value: r.capacityKg != null ? String(r.capacityKg) : '—' },
    { label: '精度(g)', value: r.precisionG != null ? String(r.precisionG) : '—' },
    { label: '接口', value: r.interface || '—' },
    { label: '校准状态', value: calInfo.label },
    { label: '上次校准', value: r.lastCalibrationDate || '—' },
    { label: '下次校准', value: r.nextCalibrationDate || '—' },
    { label: '校准周期(天)', value: r.calibrationCycleDays != null ? String(r.calibrationCycleDays) : '—' },
    { label: '安装位置', value: r.installLocation || '—', copyable: true },
    { label: '状态', value: r.status },
    { label: '备注', value: r.remark || '—', span: 2 },
  ]
})

// — 复制（不依赖 canEdit，查看者可复制白名单字段）—
const { copy } = useClipboard()
function copyField(value: string, label: string) {
  copy(value, label)
}

// — 导出当前页 CSV（UTF-8 BOM，仅白名单列，不新增 API）—
const csvColumns: CsvColumn<ScaleItem>[] = [
  { prop: 'brand', label: '品牌' },
  { prop: 'model', label: '型号' },
  { prop: 'assetNo', label: '资产编号' },
  { prop: 'serialNo', label: '序列号' },
  { prop: 'installLocation', label: '位置' },
]
function handleExportCsv() {
  if (scaleList.value.length === 0) {
    ElMessage.warning('当前页无数据可导出')
    return
  }
  exportCurrentPageCsv('电子称台账', csvColumns, scaleList.value)
  ElMessage.success(`已导出当前页 ${scaleList.value.length} 条数据`)
}
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; margin-bottom: var(--spacing-card); }
.drawer-id { font-weight: 600; color: var(--text-primary); margin-right: 8px; }
.drawer-field { display: inline-flex; align-items: center; gap: 4px; }
.drawer-copy-btn { padding: 0; min-height: auto; color: var(--text-secondary); }
.drawer-copy-btn:hover { color: var(--color-primary); }
</style>
