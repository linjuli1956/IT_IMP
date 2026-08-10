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

    <el-tabs v-model="activeTab" class="device-tabs" @tab-change="onTabChange">
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

      <!-- 网络拓扑 Tab -->
      <el-tab-pane label="网络拓扑" name="topology">
        <div class="quick-tip">
          <el-icon><InfoFilled /></el-icon>
          <span>力导向图自动排布 · 滚轮缩放 · 拖拽浏览 · 节点填充色=设备类型 · 边框色=设备状态 · 未配置连线显示空态</span>
        </div>

        <div class="card filter-bar">
          <el-select v-model="topoStoreId" placeholder="按门店筛选" clearable style="width: 200px" @change="fetchTopology">
            <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-select v-model="topoDeviceType" placeholder="设备类型" clearable style="width: 140px">
            <el-option v-for="t in networkDeviceTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
          </el-select>
          <el-button :icon="Refresh" @click="fetchTopology" :loading="topoLoading">刷新</el-button>
          <span class="filter-count">{{ filteredTopoDevices.length }} 台设备 · {{ displayTopoLinks.length }} 条连线</span>
        </div>

        <!-- 拓扑图 / 空态 -->
        <div class="card topology-card">
          <div v-if="topoLoading" class="chart-loading">
            <el-icon size="32" color="var(--border-base)"><DataLine /></el-icon>
            <p>拓扑图加载中...</p>
          </div>
          <EmptyState
            v-else-if="displayTopoLinks.length === 0"
            :icon="Connection"
            description="尚未配置网络连接关系"
          />
          <ClientOnly v-else>
            <v-chart
              class="topology-chart"
              :option="chartOption"
              autoresize
              @click="onChartClick"
            />
            <template #fallback>
              <div class="chart-loading">
                <el-icon size="32" color="var(--border-base)"><DataLine /></el-icon>
                <p>拓扑图加载中...</p>
              </div>
            </template>
          </ClientOnly>
        </div>

        <!-- 图例说明 -->
        <div class="card legend-card">
          <div class="legend-section">
            <span class="legend-title">设备类型色</span>
            <div class="legend-items">
              <div v-for="c in typeColors" :key="c.type" class="legend-item">
                <span class="legend-dot" :style="{ background: c.color }"></span>
                <span>{{ c.type }}</span>
              </div>
            </div>
          </div>
          <div class="legend-section">
            <span class="legend-title">状态边框</span>
            <div class="legend-items">
              <div class="legend-item">
                <span class="legend-dot legend-border" style="border-color: #67C23A; background: transparent"></span>
                <span>正常</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-border" style="border-color: #909399; background: transparent; opacity: 0.5"></span>
                <span>停用</span>
              </div>
              <div class="legend-item">
                <span class="legend-dot legend-border" style="border-color: #F56C6C; background: transparent; opacity: 0.3"></span>
                <span>报废</span>
              </div>
            </div>
          </div>
        </div>
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
          <el-button v-if="canEdit" type="primary" size="small" @click="openLinkDialog">
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

    <!-- 新增连线 Dialog -->
    <el-dialog v-model="linkDialogVisible" title="新增连线" width="500px" :destroy-on-close="true">
      <el-form :model="linkForm" label-width="90px" size="default">
        <el-form-item label="当前设备">
          <span>{{ linkForm.sourceName }}</span>
        </el-form-item>
        <el-form-item label="目标设备" required>
          <el-select v-model="linkForm.targetDeviceId" placeholder="选择同门店设备" filterable style="width: 100%">
            <el-option
              v-for="d in linkTargetOptions"
              :key="d.id"
              :label="d.label"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="源端口">
          <el-input v-model="linkForm.sourcePort" placeholder="如 Gig1/0/1（可选）" />
        </el-form-item>
        <el-form-item label="目标端口">
          <el-input v-model="linkForm.targetPort" placeholder="如 Gig0/1（可选）" />
        </el-form-item>
        <el-form-item label="连接类型" required>
          <el-select v-model="linkForm.linkType" style="width: 100%">
            <el-option v-for="t in linkTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="linkForm.remark" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="linkDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="linkSaving" @click="handleAddLink">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import {
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, InfoFilled, DataLine, Connection } from '@element-plus/icons-vue'
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

// —— ECharts 模块注册 ——
use([
  CanvasRenderer,
  GraphChart,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
])

// —— Tab 切换 ——
const activeTab = ref<'ledger' | 'topology'>('ledger')
let topoLoaded = false

function onTabChange(name: string | number) {
  if (name === 'topology' && !topoLoaded) {
    fetchTopology()
  }
}

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
// 网络拓扑
// =====================

// —— 拓扑数据 ——
interface TopologyLink {
  id: number
  sourceDeviceId: number
  sourcePort: string
  targetDeviceId: number
  targetPort: string
  linkType: string
  remark: string
}

const topoDevices = ref<NetworkDeviceItem[]>([])
const topoLinks = ref<TopologyLink[]>([])
const topoLoading = ref(false)
const topoError = ref('')

// —— 拓扑筛选 ——
const topoStoreId = ref<number | null>(null)
const topoDeviceType = ref<string>('')

// —— 设备类型色板 ——
const typeColors = [
  { type: '交换机', color: '#409EFF' },
  { type: '路由器', color: '#E6A23C' },
  { type: '防火墙', color: '#F56C6C' },
  { type: 'AP', color: '#67C23A' },
  { type: '其他', color: '#909399' },
]
const deviceTypes = ['交换机', '路由器', '防火墙', 'AP', '其他']

// —— 连接类型选项 ——
const linkTypeOptions = ['上联', '级联', '直连', '其他']

function statusBorderColor(status: string): string {
  if (status === '正常') return '#67C23A'
  if (status === '报废') return '#F56C6C'
  return '#909399'
}
function statusOpacity(status: string): number {
  if (status === '正常') return 1
  if (status === '停用') return 0.5
  if (status === '报废') return 0.3
  return 1
}

async function fetchTopology() {
  topoLoading.value = true
  topoError.value = ''
  topoLoaded = true
  try {
    const { get } = useApi()
    const query: Record<string, string | number> = {}
    if (topoStoreId.value) query.storeId = topoStoreId.value
    const data = await get<{ devices: NetworkDeviceItem[]; links: TopologyLink[] }>('/api/network-devices/topology', { query })
    topoDevices.value = data.devices
    topoLinks.value = data.links
  } catch (e) {
    topoError.value = getApiErrorMessage(e)
    topoDevices.value = []
    topoLinks.value = []
  } finally {
    topoLoading.value = false
  }
}

// —— 筛选后设备 ——
const filteredTopoDevices = computed(() => topoDevices.value.filter((d) => {
  const type = !topoDeviceType.value || d.deviceType === topoDeviceType.value
  return type
}))

// —— 筛选后连线（两端设备都在筛选结果中） ——
const filteredTopoIds = computed(() => new Set(filteredTopoDevices.value.map(d => d.id)))
const displayTopoLinks = computed(() => topoLinks.value.filter(
  l => filteredTopoIds.value.has(l.sourceDeviceId) && filteredTopoIds.value.has(l.targetDeviceId),
))

// —— 设备名格式化 ——
function topoDeviceName(d: NetworkDeviceItem): string {
  const parts = [d.brand, d.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${d.deviceType}`
}

// —— ECharts 图表配置 ——
const chartOption = computed(() => {
  const devices = filteredTopoDevices.value
  const links = displayTopoLinks.value

  const categories = deviceTypes.map((t) => {
    const c = typeColors.find((x) => x.type === t)
    return { name: t, itemStyle: { color: c?.color || '#909399' } }
  })

  const nodes = devices.map((d) => {
    const typeIdx = deviceTypes.indexOf(d.deviceType)
    const borderColor = statusBorderColor(d.status)
    const opacity = statusOpacity(d.status)
    const symbolSize = d.remark?.includes('核心') ? 60 : 45
    return {
      id: String(d.id),
      name: topoDeviceName(d),
      category: typeIdx >= 0 ? typeIdx : 4,
      symbolSize,
      value: d.id,
      itemStyle: { color: typeColors.find((c) => c.type === d.deviceType)?.color || '#909399', borderColor, borderWidth: 2, opacity },
      label: { show: true, position: 'bottom', fontSize: 11, color: '#303133' },
      deviceData: d,
    }
  })

  const edges = links.map((l) => {
    const sourceDevice = devices.find((d) => d.id === l.sourceDeviceId)
    const targetDevice = devices.find((d) => d.id === l.targetDeviceId)
    const portInfo = [l.sourcePort, l.targetPort].filter(Boolean).join(' → ')
    return {
      source: String(l.sourceDeviceId),
      target: String(l.targetDeviceId),
      value: l.linkType,
      label: { show: true, formatter: l.linkType, fontSize: 10, color: '#909399' },
      lineStyle: { color: '#C0C4CC', width: 2, curveness: 0.1 },
      linkData: l,
      portInfo,
      sourceName: sourceDevice ? topoDeviceName(sourceDevice) : '',
      targetName: targetDevice ? topoDeviceName(targetDevice) : '',
    }
  })

  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const d = params.data?.deviceData
          if (!d) return params.name
          return [
            `<b>${topoDeviceName(d)}</b>`,
            `类型：${d.deviceType}`,
            `管理IP：${d.managementIp || '—'}`,
            `端口数：${d.portCount ?? '—'}`,
            `状态：${d.status}`,
            `位置：${d.installLocation || '—'}`,
          ].join('<br/>')
        }
        if (params.dataType === 'edge') {
          const l = params.data
          return [
            `<b>${l.value}</b>`,
            `${l.sourceName} → ${l.targetName}`,
            l.portInfo ? `端口：${l.portInfo}` : '',
          ].filter(Boolean).join('<br/>')
        }
        return params.name
      },
    },
    legend: [{ data: deviceTypes, bottom: 10, textStyle: { color: '#606266' } }],
    toolbox: { show: true, right: 20, feature: { restore: { title: '还原' } } },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      label: { show: true },
      edgeLabel: { show: true, fontSize: 10, color: '#909399' },
      force: { repulsion: 300, edgeLength: [120, 200], gravity: 0.08, layoutAnimation: true },
      emphasis: { focus: 'adjacency', lineStyle: { width: 4 }, label: { fontSize: 13, fontWeight: 'bold' } },
      data: nodes,
      links: edges,
      categories,
    }],
  }
})

// —— 节点点击 → 设备详情抽屉 ——
const drawerVisible = ref(false)
const currentDevice = ref<NetworkDeviceItem | null>(null)

function onChartClick(params: any) {
  if (params.dataType === 'node') {
    const d = params.data?.deviceData as NetworkDeviceItem | undefined
    if (d) {
      currentDevice.value = d
      drawerVisible.value = true
    }
  }
}

const drawerTitle = computed(() => currentDevice.value ? topoDeviceName(currentDevice.value) : '设备详情')
const drawerHeaderLabel = computed(() => {
  if (!currentDevice.value) return ''
  const d = currentDevice.value
  return `${d.deviceType} · ${d.storeName || ''}`
})

const drawerItems = computed<{ label: string; value: string; span?: number }[]>(() => {
  const d = currentDevice.value
  if (!d) return []
  return [
    { label: '名称', value: topoDeviceName(d) },
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
      result.push({ id: l.id, direction: 'out', peerName: peer ? topoDeviceName(peer) : `#${l.targetDeviceId}`, selfPort: l.sourcePort, peerPort: l.targetPort, linkType: l.linkType, remark: l.remark })
    } else if (l.targetDeviceId === d.id) {
      const peer = topoDevices.value.find((x) => x.id === l.sourceDeviceId)
      result.push({ id: l.id, direction: 'in', peerName: peer ? topoDeviceName(peer) : `#${l.sourceDeviceId}`, selfPort: l.targetPort, peerPort: l.sourcePort, linkType: l.linkType, remark: l.remark })
    }
  }
  return result
})

// —— 新增连线 ——
const linkDialogVisible = ref(false)
const linkSaving = ref(false)
const linkForm = reactive({
  sourceDeviceId: 0,
  sourceName: '',
  targetDeviceId: null as number | null,
  sourcePort: '',
  targetPort: '',
  linkType: '直连',
  remark: '',
})

function openLinkDialog() {
  const d = currentDevice.value
  if (!d) return
  linkForm.sourceDeviceId = d.id
  linkForm.sourceName = topoDeviceName(d)
  linkForm.targetDeviceId = null
  linkForm.sourcePort = ''
  linkForm.targetPort = ''
  linkForm.linkType = '直连'
  linkForm.remark = ''
  linkDialogVisible.value = true
}

// 目标设备选项：同门店、排除自身
const linkTargetOptions = computed(() => {
  const d = currentDevice.value
  if (!d) return []
  return topoDevices.value
    .filter((x) => x.storeId === d.storeId && x.id !== d.id)
    .map((x) => ({ id: x.id, label: topoDeviceName(x) }))
})

async function handleAddLink() {
  if (!linkForm.targetDeviceId) {
    ElMessage.warning('请选择目标设备')
    return
  }
  linkSaving.value = true
  try {
    const { post } = useApi()
    await post('/api/network-devices/links', {
      sourceDeviceId: linkForm.sourceDeviceId,
      targetDeviceId: linkForm.targetDeviceId,
      sourcePort: linkForm.sourcePort,
      targetPort: linkForm.targetPort,
      linkType: linkForm.linkType,
      remark: linkForm.remark,
    })
    ElMessage.success('连线创建成功')
    linkDialogVisible.value = false
    await fetchTopology()
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
    await fetchTopology()
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}
</script>

<style scoped>
.device-tabs {
  margin-bottom: var(--spacing-card);
}

.quick-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  margin-bottom: var(--spacing-card);
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-card);
}

.filter-count {
  margin-left: auto;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
}

.topology-card {
  height: 520px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.topology-chart {
  width: 100%;
  height: 100%;
}

.chart-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-placeholder);
  font-size: var(--font-size-small);
}

.legend-card {
  display: flex;
  gap: 40px;
  flex-wrap: wrap;
  padding: 12px 20px;
}

.legend-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.legend-title {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}

.legend-items {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.legend-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  display: inline-block;
}

.legend-border {
  border-width: 2px;
  border-style: solid;
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
