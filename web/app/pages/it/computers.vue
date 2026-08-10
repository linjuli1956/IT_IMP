<template>
  <div class="page-container">
    <PageHeader
      title="电脑管理"
      subtitle="门店电脑资产台账"
      :description="`管理门店电脑（配置+IP），按门店归属。资产编号/序列号/MAC 本模块内唯一。仅管理员与操作员可编辑。`"
    >
      <template #actions>
        <el-button v-if="canEdit" type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          新增电脑
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <AssetFilters
        :fields="filterFields"
        :keyword="{ key: 'keyword', placeholder: '搜索品牌/型号/使用人/资产编号/IP' }"
        :model="filters"
        @update="handleFilterChange"
      />
    </div>

    <div class="card">
      <AssetTable
        :columns="columns"
        :data="computerList"
        :total="total"
        :loading="loading"
        :page="page"
        :page-size="pageSize"
        :error="error"
        :can-edit="canEdit"
        @page-change="handlePageChange"
        @edit="(row: any) => handleEdit(row)"
        @delete="(row: any) => handleDelete(row)"
      >
        <template #name="{ row }">
          <RecordPreviewTooltip :title="formatName(row as ComputerItem)" :rows="buildComputerPreviewRows(row as ComputerItem)">
            <template #reference>
              <span class="computer-name" tabindex="0" :aria-label="`预览电脑 ${formatName(row as ComputerItem)}`">{{ formatName(row as ComputerItem) }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useComputerData, computerDiskTypeOptions } from '~/composables/useComputerData'
import { useStoreData } from '~/composables/useStoreData'
import { getApiErrorMessage } from '~/composables/useApi'
import { assetStatusOptions } from '~/utils/asset-utils'
import { buildComputerPreviewRows } from '~/utils/preview-utils'
import type { AssetFilterField, AssetFilterOption } from '~/components/asset/AssetFilters.vue'
import type { AssetFieldConfig } from '~/components/asset/AssetFormDialog.vue'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'
import type { ComputerItem } from '~/types/computer'

const {
  computerList, total, loading, page, pageSize, error,
  fetchComputers, addComputer, updateComputer, deleteComputer,
} = useComputerData()
const { storeList } = useStoreData()

const canEdit = ref(false)
interface ComputerFilters {
  keyword?: string
  status?: string
  storeId?: number
}
const filters = reactive<ComputerFilters>({})

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchComputers()
})

const storeIdOptions = computed<AssetFilterOption[]>(() => storeList.value.map(s => ({ label: s.name, value: s.id })))
const filterFields = computed<AssetFilterField<ComputerFilters>[]>(() => [
  { key: 'status', label: '状态', options: assetStatusOptions },
  { key: 'storeId', label: '门店', options: storeIdOptions.value },
])

function handleFilterChange(patch: Record<string, any>) {
  Object.assign(filters, patch)
  fetchComputers({ page: 1, ...filters })
}
function handlePageChange(p: number, s: number) {
  fetchComputers({ page: p, pageSize: s, ...filters })
}

const columns: AssetColumn<ComputerItem>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 170, slot: 'name' },
  { key: 'storeName', label: '门店', width: 130, slot: 'storeName' },
  { key: 'assetNo', label: '资产编号', width: 110 },
  { key: 'user', label: '使用人', width: 90 },
  { key: 'department', label: '部门', width: 100 },
  { key: 'ipAddress', label: 'IP', width: 120 },
  { key: 'os', label: '系统', width: 100 },
  { key: 'warrantyEndDate', label: '保修到期', width: 110, align: 'center' as const },
  { key: 'status', label: '状态', width: 80, align: 'center' as const, type: 'status' as const },
]

const dialogVisible = ref(false)
const dialogTitle = ref('新增电脑')
const saving = ref(false)
const currentForm = ref<Partial<ComputerItem>>({})

const formFields = computed<AssetFieldConfig<ComputerItem>[]>(() => [
  { key: 'storeId', label: '门店', type: 'select', required: true, options: storeIdOptions.value, width: 'half', placeholder: '选择门店' },
  { key: 'assetNo', label: '资产编号', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'department', label: '部门', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'brand', label: '品牌', type: 'input', width: 'half', placeholder: '联想/戴尔/HP等', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'model', label: '型号', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'serialNo', label: '序列号', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'user', label: '使用人', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'cpuModel', label: 'CPU型号', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'cpuCores', label: 'CPU核数', type: 'number', min: 0, precision: 0, width: 'half' },
  { key: 'memoryGB', label: '内存(GB)', type: 'number', min: 0, precision: 0, width: 'half' },
  { key: 'diskSizeGB', label: '硬盘(GB)', type: 'number', min: 0, precision: 0, width: 'half' },
  { key: 'diskType', label: '硬盘类型', type: 'select', options: computerDiskTypeOptions, width: 'half' },
  { key: 'ipAddress', label: 'IP地址', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'macAddress', label: 'MAC地址', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'os', label: '操作系统', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'osVersion', label: '系统版本', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'purchaseDate', label: '采购日期', type: 'date', width: 'half' },
  { key: 'warrantyEndDate', label: '保修到期', type: 'date', width: 'half' },
  { key: 'status', label: '状态', type: 'select', required: true, options: assetStatusOptions, width: 'half' },
  { key: 'remark', label: '备注', type: 'textarea', width: 'full' },
])

function formatName(row: ComputerItem): string {
  const parts = [row.brand, row.model].filter(Boolean)
  return parts.length ? parts.join(' ') : (row.assetNo || `电脑#${row.id}`)
}

function openAdd() {
  dialogTitle.value = '新增电脑'
  currentForm.value = {}
  dialogVisible.value = true
}

function handleEdit(row: ComputerItem) {
  dialogTitle.value = '编辑电脑'
  currentForm.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit(payload: Partial<ComputerItem>) {
  saving.value = true
  try {
    const id = currentForm.value.id
    if (id) {
      await updateComputer(id, payload)
      ElMessage.success('编辑成功')
    } else {
      await addComputer(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchComputers({ page: id ? page.value : 1, ...filters })
  } catch (e) {
    ElMessage.error(getApiErrorMessage(e))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: ComputerItem) {
  try {
    await ElMessageBox.confirm(`确定要删除电脑"${formatName(row as ComputerItem)}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteComputer(row.id)
    ElMessage.success('删除成功')
    fetchComputers({ page: 1, ...filters })
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(getApiErrorMessage(e))
  }
}
</script>

<style scoped>
</style>
