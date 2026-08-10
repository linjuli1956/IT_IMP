<!--
  网络拓扑图静态设计稿（阶段 0 交付物）。
  设计依据：docs/网络拓扑图设计方案.md
  范式：不请求 API / 假数据 / 门店筛选真实生效 / 角色可切换 / 自然响应式。
  覆盖：核心交换机 / 接入交换机 / 路由器 / 防火墙 / AP / 停用 / 报废 / 未连线设备。
  技术选型：ECharts 6 graph（force layout），不引入 X6。
  Mock 规则：source=上游、target=下游；禁止自连接；禁止同方向+反方向重复；第一版两端设备同门店；删除设备 Restrict（409）。
  冻结边界：不改 Prisma、API、it/network-devices.vue 正式页面。
-->
<template>
  <div class="network-topology">
    <PageHeader title="网络拓扑图" subtitle="网络设备连接关系可视化（设计稿）">
      <template #actions>
        <el-radio-group v-model="currentRole" size="small" class="role-switcher">
          <el-radio-button value="admin">管理员</el-radio-button>
          <el-radio-button value="viewer">查看者</el-radio-button>
        </el-radio-group>
      </template>
    </PageHeader>

    <div class="quick-tip">
      <el-icon><InfoFilled /></el-icon>
      <span>力导向图自动排布 · 滚轮缩放 · 拖拽浏览 · 节点填充色=设备类型 · 边框色=设备状态 · 未配置连线显示空态</span>
    </div>

    <div class="card filter-bar">
      <el-select v-model="selectedStore" placeholder="按门店筛选" clearable style="width: 200px">
        <el-option v-for="s in mockStores" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="selectedType" placeholder="设备类型" clearable style="width: 140px">
        <el-option v-for="t in deviceTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <el-button @click="toggleEmptyState">
        {{ showEmptyState ? '显示正常拓扑' : '模拟空态（无连线）' }}
      </el-button>
      <span class="filter-count">{{ filteredDevices.length }} 台设备 · {{ displayLinks.length }} 条连线</span>
    </div>

    <!-- 拓扑图 / 空态 -->
    <div class="card topology-card">
      <EmptyState
        v-if="showEmptyState || displayLinks.length === 0"
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

    <!-- 设备详情抽屉（节点点击打开） -->
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
      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
      </template>
    </AssetDetailDrawer>
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
import { InfoFilled, DataLine, Connection } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getAssetStatusTagType } from '~/utils/asset-utils'

// —— ECharts 模块注册 ——
use([
  CanvasRenderer,
  GraphChart,
  TooltipComponent,
  LegendComponent,
  ToolboxComponent,
])

// —— 角色切换 ——
const currentRole = ref<'admin' | 'viewer'>('admin')
const canEdit = computed(() => currentRole.value === 'admin')

// —— 空态切换（截图用）——
const showEmptyState = ref(false)
function toggleEmptyState() {
  showEmptyState.value = !showEmptyState.value
}

// —— 设备类型色板（填充色=类型，边框色=状态）——
const typeColors = [
  { type: '交换机', color: '#409EFF' },
  { type: '路由器', color: '#E6A23C' },
  { type: '防火墙', color: '#F56C6C' },
  { type: 'AP', color: '#67C23A' },
  { type: '其他', color: '#909399' },
]
const deviceTypes = ['交换机', '路由器', '防火墙', 'AP', '其他']

// —— 状态 → 边框色 ——
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

// —— Mock 门店 ——
const mockStores = [
  { id: 1, name: '总部' },
  { id: 2, name: '泰兴店' },
  { id: 3, name: '黄桥店' },
]

// —— Mock 设备数据（覆盖各类设备 + 停用/报废/未连线）——
const mockDevices: any[] = [
  { id: 1, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: '华为', model: 'S5735', serialNo: 'SN2024HW001', managementIp: '192.168.1.2', macAddress: 'A4-B1-C2-D3-E4-F5', portCount: 24, uplinkPort: 'Gig1/0/1', firmwareVersion: 'V200R019', installLocation: '一楼弱电井', status: '正常', remark: '核心交换机' },
  { id: 2, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: 'H3C', model: 'S1820', serialNo: 'SN2024H3C002', managementIp: '192.168.1.3', macAddress: 'B5-C2-D3-E4-F5-A6', portCount: 8, uplinkPort: 'Gig0/1', firmwareVersion: 'V5', installLocation: '二楼弱电井', status: '正常', remark: '接入交换机' },
  { id: 3, storeId: 1, storeName: '总部', deviceType: '路由器', manageType: '网管型', brand: '华为', model: 'AR2220', serialNo: 'SN2024HW003', managementIp: '192.168.1.1', macAddress: 'C6-D3-E4-F5-A6-B7', portCount: 4, uplinkPort: 'GE0/0/1', firmwareVersion: 'V200R010', installLocation: '机房', status: '正常', remark: '出口路由' },
  { id: 4, storeId: 1, storeName: '总部', deviceType: '防火墙', manageType: '网管型', brand: '深信服', model: 'AF-2000', serialNo: 'SN2024SF004', managementIp: '192.168.1.254', macAddress: 'D7-E4-F5-A6-B7-C8', portCount: 8, uplinkPort: 'GE0', firmwareVersion: 'V8.0', installLocation: '机房入口', status: '正常', remark: '边界防火墙' },
  { id: 5, storeId: 1, storeName: '总部', deviceType: 'AP', manageType: '非网管', brand: 'TP-LINK', model: 'TL-AP', serialNo: 'SN2024TP005', managementIp: null, macAddress: 'E8-F5-A6-B7-C8-D9', portCount: 1, uplinkPort: null, firmwareVersion: null, installLocation: '卖场', status: '正常', remark: '无线AP' },
  { id: 6, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: '锐捷', model: 'S2900', serialNo: 'SN2023RG006', managementIp: '192.168.1.4', macAddress: 'F9-A6-B7-C8-D9-E0', portCount: 24, uplinkPort: 'Gig0/1', firmwareVersion: 'V12', installLocation: '仓库', status: '停用', remark: '已替换待回收' },
  { id: 7, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '非网管', brand: 'TP-LINK', model: 'TL-SF', serialNo: 'SN2022TP007', managementIp: null, macAddress: null, portCount: 5, uplinkPort: null, firmwareVersion: null, installLocation: '库房', status: '报废', remark: '已报废' },
  { id: 8, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: 'H3C', model: 'S5120', serialNo: 'SN2025H3C008', managementIp: '192.168.1.5', macAddress: 'A1-B2-C3-D4-E5-F6', portCount: 24, uplinkPort: 'Gig0/1', firmwareVersion: 'V7', installLocation: '三楼弱电井', status: '正常', remark: '尚未配置连线' },
]

// —— Mock 连线数据 ——
// 校验规则：source=上游、target=下游；无自连接；无同方向/反方向重复；两端设备同门店；删除设备 Restrict(409)
// 全部连线两端均为 storeId=1（总部），符合第一版同门店约束
const mockLinks: any[] = [
  { id: 1, sourceDeviceId: 1, sourcePort: 'Gig1/0/24', targetDeviceId: 2, targetPort: 'Gig0/1', linkType: '上联', remark: '核心→接入' },
  { id: 2, sourceDeviceId: 1, sourcePort: 'Gig1/0/1', targetDeviceId: 3, targetPort: 'GE0/0/1', linkType: '直连', remark: '核心→路由器' },
  { id: 3, sourceDeviceId: 3, sourcePort: 'GE0/0/2', targetDeviceId: 4, targetPort: 'GE0', linkType: '直连', remark: '路由器→防火墙' },
  { id: 4, sourceDeviceId: 1, sourcePort: 'Gig1/0/23', targetDeviceId: 5, targetPort: '', linkType: '直连', remark: '核心→AP' },
]

// —— 门店/类型筛选 ——
const selectedStore = ref<number | null>(null)
const selectedType = ref<string>('')

const filteredDevices = computed(() => mockDevices.filter((d) => {
  const store = !selectedStore.value || d.storeId === selectedStore.value
  const type = !selectedType.value || d.deviceType === selectedType.value
  return store && type
}))

// 连线需两端设备都在筛选结果中
const filteredLinkIds = computed(() => new Set(filteredDevices.value.map((d) => d.id)))
const displayLinks = computed(() => {
  if (showEmptyState.value) return []
  return mockLinks.filter((l) => filteredLinkIds.value.has(l.sourceDeviceId) && filteredLinkIds.value.has(l.targetDeviceId))
})

// —— 设备名格式化 ——
function formatDeviceName(d: any): string {
  return [d.brand, d.model].filter(Boolean).join(' ') || `未命名${d.deviceType}`
}

// —— ECharts 图表配置 ——
const chartOption = computed(() => {
  const devices = filteredDevices.value
  const links = displayLinks.value

  // 分类：按设备类型（图例分组）
  const categories = deviceTypes.map((t) => {
    const c = typeColors.find((x) => x.type === t)
    return { name: t, itemStyle: { color: c?.color || '#909399' } }
  })

  // 节点：填充色=类型色，边框色=状态色
  const nodes = devices.map((d) => {
    const typeIdx = deviceTypes.indexOf(d.deviceType)
    const borderColor = statusBorderColor(d.status)
    const opacity = statusOpacity(d.status)
    // 核心交换机节点稍大
    const symbolSize = d.remark?.includes('核心') ? 60 : 45
    return {
      id: String(d.id),
      name: formatDeviceName(d),
      category: typeIdx >= 0 ? typeIdx : 4,
      symbolSize,
      value: d.id,
      itemStyle: {
        color: typeColors.find((c) => c.type === d.deviceType)?.color || '#909399',
        borderColor,
        borderWidth: 2,
        opacity,
      },
      label: { show: true, position: 'bottom', fontSize: 11, color: '#303133' },
      // 设备数据存入 data 供 tooltip 使用
      deviceData: d,
    }
  })

  // 连线
  const edges = links.map((l) => {
    const sourceDevice = devices.find((d) => d.id === l.sourceDeviceId)
    const targetDevice = devices.find((d) => d.id === l.targetDeviceId)
    const portInfo = [l.sourcePort, l.targetPort].filter(Boolean).join(' → ')
    return {
      source: String(l.sourceDeviceId),
      target: String(l.targetDeviceId),
      value: l.linkType,
      label: {
        show: true,
        formatter: l.linkType,
        fontSize: 10,
        color: '#909399',
      },
      lineStyle: {
        color: '#C0C4CC',
        width: 2,
        curveness: 0.1,
      },
      linkData: l,
      portInfo,
      sourceName: sourceDevice ? formatDeviceName(sourceDevice) : '',
      targetName: targetDevice ? formatDeviceName(targetDevice) : '',
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
            `<b>${formatDeviceName(d)}</b>`,
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
    legend: [
      {
        data: deviceTypes,
        bottom: 10,
        textStyle: { color: '#606266' },
      },
    ],
    toolbox: {
      show: true,
      right: 20,
      feature: {
        restore: { title: '还原' },
      },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        label: { show: true },
        edgeLabel: { show: true, fontSize: 10, color: '#909399' },
        force: {
          repulsion: 300,
          edgeLength: [120, 200],
          gravity: 0.08,
          layoutAnimation: true,
        },
        emphasis: {
          focus: 'adjacency',
          lineStyle: { width: 4 },
          label: { fontSize: 13, fontWeight: 'bold' },
        },
        data: nodes,
        links: edges,
        categories,
      },
    ],
  }
})

// —— 节点点击 → 打开设备详情抽屉 ——
const drawerVisible = ref(false)
const currentDevice = ref<any>(null)

function onChartClick(params: any) {
  if (params.dataType === 'node') {
    const d = params.data?.deviceData
    if (d) {
      currentDevice.value = d
      drawerVisible.value = true
    }
  }
}

const drawerTitle = computed(() => {
  if (!currentDevice.value) return '设备详情'
  return formatDeviceName(currentDevice.value)
})

const drawerHeaderLabel = computed(() => {
  if (!currentDevice.value) return ''
  const d = currentDevice.value
  return `${d.deviceType} · ${d.storeName || ''}`
})

const drawerItems = computed<{ label: string; value: string; span?: number }[]>(() => {
  const d = currentDevice.value
  if (!d) return []
  return [
    { label: '名称', value: formatDeviceName(d) },
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
</script>

<style scoped>
.quick-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: var(--font-size-small);
  margin-bottom: var(--spacing-card);
}

.role-switcher {
  margin-right: 8px;
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

/* —— 图例卡片 —— */
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
</style>
