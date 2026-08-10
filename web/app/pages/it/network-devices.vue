<template>
  <div class="page-container">
    <PageHeader
      title="网络设备"
      subtitle="门店网络设备台账"
      :description="`管理门店网络设备：网管交换机、企业级路由器、AP 等。序列号/管理IP/MAC 本模块内唯一。仅管理员与操作员可编辑。`"
    >
      <template #actions>
        <el-button v-if="canEdit && activeTab === 'ledger'" type="primary" @click="openAdd">
          <el-icon><Plus /></el-icon>
          新增设备
        </el-button>
      </template>
    </PageHeader>

    <el-tabs v-model="activeTab" class="device-tabs">
      <!-- 台账列表 Tab（默认，保持既有 CRUD） -->
      <el-tab-pane label="台账列表" name="ledger">
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
      </el-tab-pane>

      <!-- 网络拓扑 Tab（懒加载） -->
      <el-tab-pane label="网络拓扑" name="topology" lazy>
        <NetworkTopologyPanel
          ref="topoPanelRef"
          :can-edit="canEdit"
          :store-list="storeListForTopo"
          @node-click="onNodeClick"
          @topology-loaded="onTopologyLoaded"
          @add-link="onToolbarAddLink"
          @go-add-device="onGoAddDevice"
        />
      </el-tab-pane>
    </el-tabs>

    <!-- 设备表单 Dialog（台账列表 Tab 共用） -->
    <AssetFormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="formFields"
      :model="currentForm"
      :saving="saving"
      @submit="handleSubmit"
    />

    <!-- 设备详情抽屉（拓扑节点点击打开） -->
    <AssetDetailDrawer v-model="drawerVisible" :title="drawerTitle" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ drawerHeaderLabel }}</span>
        <el-tag :type="getAssetStatusTagType(currentDevice?.status || '')" size="small">{{ currentDevice?.status }}</el-tag>
      </template>
      <el-descriptions v-if="currentDevice" :column="2" border size="small">
        <el-descriptions-item v-for="f in drawerItems" :key="f.label" :label="f.label" :span="f.span || 1">
          {{ f.value }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 连接关系列表 -->
      <div v-if="currentDevice" class="link-section">
        <div class="link-section-header">
          <span class="link-section-title">连接关系</span>
          <el-button v-if="canEdit" type="primary" size="small" @click="openLinkFromDrawer">
            <el-icon><Plus /></el-icon> 新增连线
          </el-button>
        </div>
        <el-table v-if="deviceLinks.length > 0" :data="deviceLinks" size="small" border>
          <el-table-column label="方向" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.direction === 'out' ? 'primary' : 'info'" size="small">
                {{ row.direction === 'out' ? '上游' : '下游' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="对端设备" min-width="160">
            <template #default="{ row }">{{ row.peerName }}</template>
          </el-table-column>
          <el-table-column label="本端端口" prop="selfPort" width="120" />
          <el-table-column label="对端端口" prop="peerPort" width="120" />
          <el-table-column label="类型" prop="linkType" width="80" align="center" />
          <el-table-column label="备注" prop="remark" min-width="100" />
          <el-table-column v-if="canEdit" label="操作" width="70" align="center">
            <template #default="{ row }">
              <el-button type="danger" text size="small" @click="handleDeleteLink(row as any)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <EmptyState v-else description="该设备暂无连接关系" />
      </div>

      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
      </template>
    </AssetDetailDrawer>

    <!-- 新增连线 Dialog（子组件，Props down / Events up） -->
    <NetworkLinkDialog
      v-model="linkDialogVisible"
      :source-device="linkSourceDevice"
      :devices="topoDevices"
      :loading="linkSaving"
      @submit="handleAddLink"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useNetworkDeviceData, networkDeviceTypeOptions, networkManageTypeOptions } from '~/composables/useNetworkDeviceData'
import { useStoreData } from '~/composables/useStoreData'
import { useApi, getApiErrorMessage } from '~/composables/useApi'
import { assetStatusOptions, getAssetStatusTagType } from '~/utils/asset-utils'
import type { AssetFilterField, AssetFilterOption } from '~/components/asset/AssetFilters.vue'
import type { AssetFieldConfig } from '~/components/asset/AssetFormDialog.vue'
import type { AssetColumn } from '~/components/asset/AssetTable.vue'
import type { NetworkDeviceItem } from '~/types/network-device'
import { applyDeviceFilterPatch, buildDeviceQuery, type DeviceFilters } from '~/utils/device-query'
import { buildDevicePreviewRows } from '~/utils/preview-utils'
import type NetworkTopologyPanel from '~/components/topology/NetworkTopologyPanel.vue'

// —— Tab 切换 ——
const activeTab = ref<'ledger' | 'topology'>('ledger')

// —— 角色权限 ——
const canEdit = ref(false)

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

// =====================
// 台账列表（既有 CRUD）
// =====================
const {
  deviceList, total, loading, page, pageSize, error,
  fetchDevices, addDevice, updateDevice, deleteDevice,
} = useNetworkDeviceData()
const { storeList } = useStoreData()

const filters = reactive<DeviceFilters>({})

// 拓扑面板用的门店列表（简化为 id + name）
const storeListForTopo = computed(() =>
  storeList.value.map(s => ({ id: s.id, name: s.name }))
)

// —— 筛选配置 ——
const storeIdOptions = computed<AssetFilterOption[]>(() => storeList.value.map(s => ({ label: s.name, value: s.id })))
const filterFields = computed<AssetFilterField<DeviceFilters>[]>(() => [
  { key: 'deviceType', label: '设备类型', options: networkDeviceTypeOptions },
  { key: 'status', label: '状态', options: assetStatusOptions },
  { key: 'storeId', label: '门店', options: storeIdOptions.value },
])

function handleFilterChange(patch: Record<string, any>) {
  Object.assign(filters, applyDeviceFilterPatch({ ...filters }, patch))
  fetchDevices(buildDeviceQuery(filters))
}
function handlePageChange(p: number, s: number) {
  fetchDevices(buildDeviceQuery(filters, p, s))
}

// —— 列配置 ——
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

// =====================
// 网络拓扑（事件编排）
// =====================

// —— 拓扑面板引用 ——
const topoPanelRef = ref<InstanceType<typeof NetworkTopologyPanel> | null>(null)

// —— 拓扑数据（由子组件 topology-loaded 事件回传） ——
const topoDevices = ref<NetworkDeviceItem[]>([])
const topoLinks = ref<{ id: number; sourceDeviceId: number; sourcePort: string; targetDeviceId: number; targetPort: string; linkType: string; remark: string }[]>([])

// —— 节点点击 → 打开抽屉 ——
const drawerVisible = ref(false)
const currentDevice = ref<NetworkDeviceItem | null>(null)

function onNodeClick(device: NetworkDeviceItem) {
  currentDevice.value = device
  drawerVisible.value = true
}

function onTopologyLoaded(devices: NetworkDeviceItem[], links: typeof topoLinks.value) {
  topoDevices.value = devices
  topoLinks.value = links
  // 抽屉中的设备信息也刷新
  if (currentDevice.value) {
    const updated = devices.find(d => d.id === currentDevice.value!.id)
    if (updated) currentDevice.value = updated
  }
}

// —— 抽屉标题 ——
const drawerTitle = computed(() => {
  const d = currentDevice.value
  if (!d) return '设备详情'
  const parts = [d.brand, d.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${d.deviceType}`
})

const drawerHeaderLabel = computed(() => {
  if (!currentDevice.value) return ''
  const d = currentDevice.value
  return `${d.deviceType} · ${d.storeName || ''}`
})

const drawerItems = computed<{ label: string; value: string; span?: number }[]>(() => {
  const d = currentDevice.value
  if (!d) return []
  const name = [d.brand, d.model].filter(Boolean).join(' ') || `未命名${d.deviceType}`
  return [
    { label: '名称', value: name },
    { label: '门店', value: d.storeName || '—' },
    { label: '设备类型', value: d.deviceType },
    { label: '管理类型', value: d.manageType || '—' },
    { label: '品牌', value: d.brand || '—' },
    { label: '型号', value: d.model || '—' },
    { label: '序列号', value: d.serialNo || '—' },
    { label: '管理IP', value: d.managementIp || '—' },
    { label: 'MAC地址', value: d.macAddress || '—' },
    { label: '端口数', value: d.portCount != null ? `${d.portCount}口` : '—' },
    { label: '上联口', value: d.uplinkPort || '—' },
    { label: '固件版本', value: d.firmwareVersion || '—' },
    { label: '安装位置', value: d.installLocation || '—' },
    { label: '状态', value: d.status },
    { label: '备注', value: d.remark || '—', span: 2 },
  ]
})

// —— 连接关系列表（当前设备的上下游连线） ——
const deviceLinks = computed(() => {
  const d = currentDevice.value
  if (!d) return []
  const result: { id: number; direction: 'out' | 'in'; peerName: string; selfPort: string; peerPort: string; linkType: string; remark: string }[] = []
  for (const l of topoLinks.value) {
    if (l.sourceDeviceId === d.id) {
      const peer = topoDevices.value.find((x) => x.id === l.targetDeviceId)
      const peerName = peer ? ([peer.brand, peer.model].filter(Boolean).join(' ') || `未命名${peer.deviceType}`) : `#${l.targetDeviceId}`
      result.push({ id: l.id, direction: 'out', peerName, selfPort: l.sourcePort, peerPort: l.targetPort, linkType: l.linkType, remark: l.remark })
    } else if (l.targetDeviceId === d.id) {
      const peer = topoDevices.value.find((x) => x.id === l.sourceDeviceId)
      const peerName = peer ? ([peer.brand, peer.model].filter(Boolean).join(' ') || `未命名${peer.deviceType}`) : `#${l.sourceDeviceId}`
      result.push({ id: l.id, direction: 'in', peerName, selfPort: l.targetPort, peerPort: l.sourcePort, linkType: l.linkType, remark: l.remark })
    }
  }
  return result
})

// —— 新增连线 ——
const linkDialogVisible = ref(false)
const linkSaving = ref(false)

// —— 新增连线来源设备（toolbar=null / drawer=currentDevice） ——
const linkSourceDevice = ref<NetworkDeviceItem | null>(null)

// 工具栏"新增连线"：无预填来源，用户选择上游+下游
function onToolbarAddLink() {
  linkSourceDevice.value = null
  linkDialogVisible.value = true
}

// 节点 Drawer"新增连线"：预填当前设备为上游
function openLinkFromDrawer() {
  linkSourceDevice.value = currentDevice.value
  linkDialogVisible.value = true
}

// "去新增设备"：切换到台账 Tab 并打开新增设备表单
function onGoAddDevice() {
  activeTab.value = 'ledger'
  openAdd()
}

async function handleAddLink(formData: { sourceDeviceId: number; targetDeviceId: number; sourcePort: string; targetPort: string; linkType: string; remark: string }) {
  linkSaving.value = true
  try {
    const { post } = useApi()
    await post('/api/network-devices/links', formData)
    ElMessage.success('连线创建成功')
    linkDialogVisible.value = false
    // 刷新拓扑面板（子组件内部 refetch + emit topology-loaded）
    await topoPanelRef.value?.fetchTopology()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    linkSaving.value = false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDeleteLink(row: any) {
  try {
    await ElMessageBox.confirm(`确定删除连线「${row.peerName}」（${row.linkType}）吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    const { delete: del } = useApi()
    await del(`/api/network-devices/links/${row.id}`)
    ElMessage.success('连线已删除')
    // 刷新拓扑面板
    await topoPanelRef.value?.fetchTopology()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}
</script>

<style scoped>
.device-tabs {
  margin-bottom: var(--spacing-card);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-card);
}

.drawer-id {
  font-weight: 600;
  color: var(--text-primary);
  margin-right: 8px;
}

.link-section {
  margin-top: var(--spacing-card);
}

.link-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.link-section-title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--text-primary);
}
</style>
