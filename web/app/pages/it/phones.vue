<template>
  <div class="page-container">
    <PageHeader
      title="固话管理"
      subtitle="门店固话台账"
      :description="`管理门店/部门固话，按门店归属。固话号码本模块内唯一。仅管理员与操作员可编辑。`"
    >
      <template #actions>
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
        @page-change="handlePageChange"
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
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { usePhoneData, phoneCarrierOptions } from '~/composables/usePhoneData'
import { useStoreData } from '~/composables/useStoreData'
import { getApiErrorMessage } from '~/composables/useApi'
import { assetStatusOptions } from '~/utils/asset-utils'
import { buildPhonePreviewRows } from '~/utils/preview-utils'
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
  { key: 'department', label: '部门', width: 110 },
  { key: 'carrier', label: '运营商', width: 90, align: 'center' as const },
  { key: 'user', label: '使用人', width: 100 },
  { key: 'extension', label: '分机号', width: 90, align: 'center' as const },
  { key: 'installLocation', label: '位置', minWidth: 120 },
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
</script>

<style scoped>
</style>
