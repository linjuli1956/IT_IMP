<template>
  <div class="page-container">
    <PageHeader
      title="固话管理"
      subtitle="门店固话台账"
      :description="`管理门店/部门固话，按门店归属。固话号码本模块内唯一。仅管理员与操作员可编辑。`"
    >
      <template #actions>
        <el-button v-if="canEdit" @click="handleExportCsv">
          <el-icon><Download /></el-icon>
          导出当前页 CSV
        </el-button>
        <el-button v-if="canEdit" type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          新增固话
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <AssetFilters
        :fields="filterFields"
        :keyword="{ key: 'keyword', placeholder: '搜索号码/使用人/部门' }"
        :model="filters"
        @update="handleFilterChange"
      />
    </div>

    <div class="card">
      <AssetTable
        :columns="columns"
        :data="phoneList"
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
        <template #phoneNumber="{ row }">
          <RecordPreviewTooltip :title="row.phoneNumber" :rows="buildPhonePreviewRows(row as PhoneItem)">
            <template #reference>
              <span class="phone-number" tabindex="0" :aria-label="`预览固话 ${row.phoneNumber}`">{{ row.phoneNumber }}</span>
            </template>
          </RecordPreviewTooltip>
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
import { usePhoneData, phoneCarrierOptions } from '~/composables/usePhoneData'
import { useStoreData } from '~/composables/useStoreData'
import { getApiErrorMessage } from '~/composables/useApi'
import { assetStatusOptions, getAssetStatusTagType } from '~/utils/asset-utils'
import { buildPhonePreviewRows } from '~/utils/preview-utils'
import { useClipboard } from '~/composables/useClipboard'
import { exportCurrentPageCsv, type CsvColumn } from '~/utils/csv-export'
import type { AssetFilterField, AssetFilterOption } from '~/components/asset/AssetFilters.vue'
import type { AssetFieldConfig } from '~/components/asset/AssetFormDialog.vue'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'
import type { PhoneItem } from '~/types/phone'

const {
  phoneList, total, loading, page, pageSize, error,
  fetchPhones, addPhone, updatePhone, deletePhone,
} = usePhoneData()
const { storeList } = useStoreData()

const canEdit = ref(false)
/** 固话筛选（独立类型：运营商替代设备类型） */
interface PhoneFilters {
  keyword?: string
  status?: string
  storeId?: number
  carrier?: string
}
const filters = reactive<PhoneFilters>({})

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchPhones()
})

// —— 筛选配置（门店 value 为数字 ID）——
const storeIdOptions = computed<AssetFilterOption[]>(() => storeList.value.map(s => ({ label: s.name, value: s.id })))
const filterFields = computed<AssetFilterField<PhoneFilters>[]>(() => [
  { key: 'carrier', label: '运营商', options: phoneCarrierOptions },
  { key: 'status', label: '状态', options: assetStatusOptions },
  { key: 'storeId', label: '门店', options: storeIdOptions.value },
])

function handleFilterChange(patch: Record<string, any>) {
  Object.assign(filters, patch) // 合并 AssetFilters 增量，回第 1 页
  fetchPhones({ page: 1, ...filters })
}
function handlePageChange(p: number, s: number) {
  fetchPhones({ page: p, pageSize: s, ...filters })
}

// —— 列配置（phoneNumber 为虚拟列：预览+展示）——
const columns: AssetColumn<PhoneItem>[] = [
  { virtual: true, key: 'phoneNumber', label: '固话号码', minWidth: 140, slot: 'phoneNumber' },
  { key: 'storeName', label: '门店', width: 130, slot: 'storeName' },
  { key: 'department', label: '部门', width: 110, copyable: true },
  { key: 'carrier', label: '运营商', width: 90, align: 'center' as const },
  { key: 'user', label: '使用人', width: 100 },
  { key: 'extension', label: '分机号', width: 90, align: 'center' as const, copyable: true },
  { key: 'installLocation', label: '位置', minWidth: 120, copyable: true },
  { key: 'status', label: '状态', width: 80, align: 'center' as const, type: 'status' as const },
]

// —— 表单配置（computed：门店异步加载后自动更新）——
const dialogVisible = ref(false)
const dialogTitle = ref('新增固话')
const saving = ref(false)
const currentForm = ref<Partial<PhoneItem>>({})

const formFields = computed<AssetFieldConfig<PhoneItem>[]>(() => [
  { key: 'storeId', label: '门店', type: 'select', required: true, options: storeIdOptions.value, width: 'half', placeholder: '选择门店' },
  { key: 'phoneNumber', label: '固话号码', type: 'input', required: true, width: 'half', placeholder: '如 0555-1234567', normalize: (v) => String(v ?? '').trim() },
  { key: 'department', label: '部门', type: 'input', width: 'half', placeholder: '如 信息部', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'carrier', label: '运营商', type: 'select', options: phoneCarrierOptions, width: 'half' },
  { key: 'extension', label: '分机号', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'monthlyFee', label: '月租(元)', type: 'number', min: 0, precision: 2, width: 'half' },
  { key: 'packageInfo', label: '套餐说明', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'user', label: '使用人', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'installLocation', label: '安装位置', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'status', label: '状态', type: 'select', required: true, options: assetStatusOptions, width: 'half' },
  { key: 'remark', label: '备注', type: 'textarea', width: 'full' },
])

function openAdd() {
  dialogTitle.value = '新增固话'
  currentForm.value = {}
  dialogVisible.value = true
}

function handleEdit(row: PhoneItem) {
  dialogTitle.value = '编辑固话'
  currentForm.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit(payload: Partial<PhoneItem>) {
  saving.value = true
  try {
    const id = currentForm.value.id
    if (id) {
      await updatePhone(id, payload)
      ElMessage.success('编辑成功')
    } else {
      await addPhone(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchPhones({ page: id ? page.value : 1, ...filters })
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: PhoneItem) {
  try {
    await ElMessageBox.confirm(`确定要删除固话"${row.phoneNumber}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deletePhone(row.id)
    ElMessage.success('删除成功')
    fetchPhones({ page: 1, ...filters })
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(getApiErrorMessage(e))
  }
}

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const currentRow = ref<PhoneItem | null>(null)
function openDrawer(row: PhoneItem) {
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
  if (!currentRow.value) return '固话详情'
  return currentRow.value.phoneNumber
})
const drawerItems = computed<{ label: string; value: string; span?: number; copyable?: boolean }[]>(() => {
  const r = currentRow.value
  if (!r) return []
  return [
    { label: '固话号码', value: r.phoneNumber || '—', copyable: true },
    { label: '门店', value: r.storeName || '—', copyable: true },
    { label: '部门', value: r.department || '—', copyable: true },
    { label: '运营商', value: r.carrier || '—' },
    { label: '使用人', value: r.user || '—' },
    { label: '分机号', value: r.extension || '—', copyable: true },
    { label: '月租(元)', value: r.monthlyFee != null ? String(r.monthlyFee) : '—' },
    { label: '套餐说明', value: r.packageInfo || '—' },
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
const csvColumns: CsvColumn<PhoneItem>[] = [
  { prop: 'phoneNumber', label: '固话号码' },
  { prop: 'extension', label: '分机号' },
  { prop: 'storeName', label: '门店' },
  { prop: 'department', label: '部门' },
  { prop: 'installLocation', label: '位置' },
]
function handleExportCsv() {
  if (phoneList.value.length === 0) {
    ElMessage.warning('当前页无数据可导出')
    return
  }
  exportCurrentPageCsv('固话台账', csvColumns, phoneList.value)
  ElMessage.success(`已导出当前页 ${phoneList.value.length} 条数据`)
}
</script>

<style scoped>
.filter-bar { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; margin-bottom: var(--spacing-card); }
.drawer-id { font-weight: 600; color: var(--text-primary); margin-right: 8px; }
.drawer-field { display: inline-flex; align-items: center; gap: 4px; }
.drawer-copy-btn { padding: 0; min-height: auto; color: var(--text-secondary); }
.drawer-copy-btn:hover { color: var(--color-primary); }
</style>
