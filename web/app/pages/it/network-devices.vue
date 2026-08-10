<template>
  <div class="page-container">
    <PageHeader
      title="网络设备"
      subtitle="门店网络设备台账"
      :description="`管理门店网络设备：网管交换机、企业级路由器、AP 等。序列号/管理IP/MAC 本模块内唯一。仅管理员与操作员可编辑。`"
    >
      <template #actions>
        <el-button v-if="canEdit" type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          新增设备
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <AssetFilters
        :fields="filterFields"
        :keyword="{ key: 'keyword', placeholder: '搜索品牌/型号/IP/位置' }"
        :model="filters"
        @update="handleFilterChange"
      />
    </div>

    <div class="card">
      <AssetTable
        :columns="columns"
        :data="deviceList"
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
          <RecordPreviewTooltip :title="formatName(row as NetworkDeviceItem)" :rows="buildDevicePreviewRows(row as NetworkDeviceItem)">
            <template #reference>
              <span class="device-name" tabindex="0" :aria-label="`预览 ${formatName(row as NetworkDeviceItem)}`">{{ formatName(row as NetworkDeviceItem) }}</span>
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
import { useNetworkDeviceData, networkDeviceTypeOptions, networkManageTypeOptions } from '~/composables/useNetworkDeviceData'
import { useStoreData } from '~/composables/useStoreData'
import { getApiErrorMessage } from '~/composables/useApi'
import { assetStatusOptions } from '~/utils/asset-utils'
import type { AssetFilterField, AssetFilterOption } from '~/components/asset/AssetFilters.vue'
import type { AssetFieldConfig } from '~/components/asset/AssetFormDialog.vue'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'
import type { NetworkDeviceItem } from '~/types/network-device'
import { applyDeviceFilterPatch, buildDeviceQuery, type DeviceFilters } from '~/utils/device-query'
import { buildDevicePreviewRows } from '~/utils/preview-utils'


const {
  deviceList, total, loading, page, pageSize, error,
  fetchDevices, addDevice, updateDevice, deleteDevice,
} = useNetworkDeviceData()
const { storeList } = useStoreData()

const canEdit = ref(false)
const filters = reactive<DeviceFilters>({})

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchDevices()
})

// —— 筛选配置（computed：门店异步加载后自动更新；门店 value 为数字 ID）——
const storeIdOptions = computed<AssetFilterOption[]>(() => storeList.value.map(s => ({ label: s.name, value: s.id })))
const filterFields = computed<AssetFilterField<DeviceFilters>[]>(() => [
  { key: 'deviceType', label: '设备类型', options: networkDeviceTypeOptions },
  { key: 'status', label: '状态', options: assetStatusOptions },
  { key: 'storeId', label: '门店', options: storeIdOptions.value },
])

function handleFilterChange(patch: Record<string, any>) {
  // 合并 AssetFilters 发出的增量 patch（纯函数，切筛选回第 1 页）
  Object.assign(filters, applyDeviceFilterPatch({ ...filters }, patch))
  fetchDevices(buildDeviceQuery(filters))
}
function handlePageChange(p: number, s: number) {
  // pageSize 必须透传（否则切 50/100 条仍用旧 pageSize）
  fetchDevices(buildDeviceQuery(filters, p, s))
}

// —— 列配置（name 为虚拟列：slot 组合 brand+model）——
const columns: AssetColumn<NetworkDeviceItem>[] = [
  { virtual: true, key: 'name', label: '名称', minWidth: 160, slot: 'name' },
  { key: 'deviceType', label: '类型', width: 90, align: 'center' as const },
  { key: 'storeName', label: '门店', width: 130, slot: 'storeName' },
  { key: 'brand', label: '品牌', width: 100 },
  { key: 'model', label: '型号', width: 120 },
  { key: 'managementIp', label: '管理IP', width: 130 },
  { key: 'portCount', label: '端口数', width: 80, align: 'center' as const },
  { key: 'installLocation', label: '位置', minWidth: 120 },
  { key: 'status', label: '状态', width: 80, align: 'center' as const, type: 'status' as const },
]

function formatName(row: NetworkDeviceItem): string {
  const parts = [row.brand, row.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${row.deviceType}`
}

// —— 表单配置 ——
const dialogVisible = ref(false)
const dialogTitle = ref('新增设备')
const saving = ref(false)
const currentForm = ref<Partial<NetworkDeviceItem>>({})

// —— 表单配置（computed：门店异步加载后自动更新；门店 value 为数字 ID）——
const formFields = computed<AssetFieldConfig<NetworkDeviceItem>[]>(() => [
  { key: 'storeId', label: '门店', type: 'select', required: true, options: storeIdOptions.value, width: 'half', placeholder: '选择门店' },
  { key: 'deviceType', label: '设备类型', type: 'select', required: true, options: networkDeviceTypeOptions, width: 'half' },
  { key: 'manageType', label: '管理类型', type: 'select', options: networkManageTypeOptions, width: 'half' },
  { key: 'brand', label: '品牌', type: 'input', width: 'half', placeholder: '华为/H3C/锐捷等', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'model', label: '型号', type: 'input', width: 'half', placeholder: '如 S5735', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'serialNo', label: '序列号', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'managementIp', label: '管理IP', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'macAddress', label: 'MAC地址', type: 'input', width: 'half', placeholder: '留空提交为 NULL', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'portCount', label: '端口数', type: 'number', min: 0, precision: 0, width: 'half' },
  { key: 'uplinkPort', label: '上联口', type: 'input', width: 'half', placeholder: '如 GigabitEthernet1/0/1', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'firmwareVersion', label: '固件版本', type: 'input', width: 'half', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'installLocation', label: '安装位置', type: 'input', width: 'half', placeholder: '如 一楼弱电井', normalize: (v) => (v ? String(v).trim() || null : null) },
  { key: 'status', label: '状态', type: 'select', required: true, options: assetStatusOptions, width: 'half' },
  { key: 'remark', label: '备注', type: 'textarea', width: 'full' },
])

function openAdd() {
  dialogTitle.value = '新增设备'
  currentForm.value = {}
  dialogVisible.value = true
}

function handleEdit(row: NetworkDeviceItem) {
  dialogTitle.value = '编辑设备'
  currentForm.value = { ...row }
  dialogVisible.value = true
}

async function handleSubmit(payload: Partial<NetworkDeviceItem>) {
  saving.value = true
  try {
    const id = currentForm.value.id
    if (id) {
      await updateDevice(id, payload)
      ElMessage.success('编辑成功')
    } else {
      await addDevice(payload)
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
    fetchDevices(buildDeviceQuery(filters, id ? page.value : 1))
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: NetworkDeviceItem) {
  try {
    await ElMessageBox.confirm(`确定要删除设备"${formatName(row as NetworkDeviceItem)}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteDevice(row.id)
    ElMessage.success('删除成功')
    fetchDevices(buildDeviceQuery(filters))
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}
</script>

<style scoped>
</style>
