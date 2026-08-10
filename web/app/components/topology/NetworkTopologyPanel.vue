<template>
  <div>
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
      <!-- 首次加载中 -->
      <div v-if="topoLoading && !topoLoaded" class="chart-loading">
        <el-icon size="32" color="var(--border-base)"><DataLine /></el-icon>
        <p>拓扑图加载中...</p>
      </div>
      <!-- 首次加载失败 -->
      <div v-else-if="topoError && !topoLoaded" class="chart-error">
        <el-icon size="32" color="var(--color-danger, #F56C6C)"><WarningFilled /></el-icon>
        <p>拓扑数据加载失败</p>
        <p v-if="topoError" class="error-detail">{{ topoError }}</p>
        <el-button size="small" @click="fetchTopology">重试</el-button>
      </div>
      <!-- 全局无连线 -->
      <EmptyState
        v-else-if="topoLinks.length === 0"
        :icon="Connection"
        description="尚未配置网络连接关系"
      />
      <!-- 有连线但筛选后无完整连线 -->
      <div v-else-if="displayTopoLinks.length === 0" class="chart-empty-filtered">
        <el-icon size="32" color="var(--border-base)"><Connection /></el-icon>
        <p>当前筛选条件下暂无完整连线</p>
        <el-button size="small" @click="clearDeviceTypeFilter">清空设备类型筛选</el-button>
      </div>
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
          <div v-for="c in typeColorEntries" :key="c.type" class="legend-item">
            <span class="legend-dot" :style="{ background: c.color }"></span>
            <span>{{ c.type }}</span>
          </div>
        </div>
      </div>
      <div class="legend-section">
        <span class="legend-title">状态边框</span>
        <div class="legend-items">
          <div v-for="s in statusBorderEntries" :key="s.status" class="legend-item">
            <span class="legend-dot legend-border" :style="{ borderColor: s.color, background: 'transparent', opacity: s.opacity }"></span>
            <span>{{ s.status }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { GraphChart } from 'echarts/charts'
import { TooltipComponent, LegendComponent, ToolboxComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Refresh, InfoFilled, DataLine, Connection, WarningFilled } from '@element-plus/icons-vue'
import { networkDeviceTypeOptions } from '~/composables/useNetworkDeviceData'
import { useApi, getApiErrorMessage } from '~/composables/useApi'
import type { NetworkDeviceItem } from '~/types/network-device'
import {
  DEVICE_TYPES, getDeviceTypeColor, getStatusBorderColor, getStatusOpacity,
  getEdgeColor, getLabelColor, getEdgeLabelColor, escapeHtml,
  getTypeColorEntries, getStatusBorderEntries,
} from '~/utils/topology-visual'

// —— ECharts 模块注册 ——
use([CanvasRenderer, GraphChart, TooltipComponent, LegendComponent, ToolboxComponent])

// —— Props ——
const props = defineProps<{
  canEdit: boolean
  storeList: { id: number; name: string }[]
}>()

// —— Emits ——
const emit = defineEmits<{
  'node-click': [device: NetworkDeviceItem]
  'topology-loaded': [devices: NetworkDeviceItem[], links: TopologyLink[]]
}>()

// —— 拓扑数据类型 ——
export interface TopologyLink {
  id: number
  sourceDeviceId: number
  sourcePort: string
  targetDeviceId: number
  targetPort: string
  linkType: string
  remark: string
}

// —— 拓扑状态 ——
const topoDevices = ref<NetworkDeviceItem[]>([])
const topoLinks = ref<TopologyLink[]>([])
const topoLoading = ref(false)
const topoLoaded = ref(false)
const topoError = ref('')

// —— 拓扑筛选 ——
const topoStoreId = ref<number | null>(null)
const topoDeviceType = ref<string>('')

// —— 图例数据 ——
const typeColorEntries = computed(() => getTypeColorEntries())
const statusBorderEntries = computed(() => getStatusBorderEntries())

// —— 设备名格式化 ——
function topoDeviceName(d: NetworkDeviceItem): string {
  const parts = [d.brand, d.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${d.deviceType}`
}

// —— 拓扑数据获取 ——
async function fetchTopology() {
  // 请求开始：清空错误状态
  topoLoading.value = true
  topoError.value = ''
  try {
    const { get } = useApi()
    const query: Record<string, string | number> = {}
    if (topoStoreId.value) query.storeId = topoStoreId.value
    const data = await get<{ devices: NetworkDeviceItem[]; links: TopologyLink[] }>('/api/network-devices/topology', { query })
    // 请求成功：更新数据、标记已加载、通知父组件
    topoDevices.value = data.devices
    topoLinks.value = data.links
    topoLoaded.value = true
    emit('topology-loaded', data.devices, data.links)
  } catch (e) {
    // 请求失败：记录错误、保留上一次成功数据、不 emit 空数组
    topoError.value = getApiErrorMessage(e)
  } finally {
    topoLoading.value = false
  }
}

// —— 暴露 fetchTopology 给父组件调用 ——
defineExpose({ fetchTopology, topoDevices, topoLinks, topoError })

// —— 首次挂载时自动加载 ——
onMounted(() => {
  fetchTopology()
})

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

// —— 清空设备类型筛选 ——
function clearDeviceTypeFilter() {
  topoDeviceType.value = ''
}

// —— ECharts 图表配置 ——
const chartOption = computed(() => {
  const devices = filteredTopoDevices.value
  const links = displayTopoLinks.value

  const categories = DEVICE_TYPES.map((t) => ({
    name: t,
    itemStyle: { color: getDeviceTypeColor(t) },
  }))

  const nodes = devices.map((d) => {
    const typeIdx = DEVICE_TYPES.indexOf(d.deviceType as typeof DEVICE_TYPES[number])
    const borderColor = getStatusBorderColor(d.status)
    const opacity = getStatusOpacity(d.status)
    const symbolSize = d.remark?.includes('核心') ? 60 : 45
    return {
      id: String(d.id),
      name: topoDeviceName(d),
      category: typeIdx >= 0 ? typeIdx : DEVICE_TYPES.length - 1,
      symbolSize,
      value: d.id,
      itemStyle: {
        color: getDeviceTypeColor(d.deviceType),
        borderColor,
        borderWidth: 2,
        opacity,
      },
      label: { show: true, position: 'bottom', fontSize: 11, color: getLabelColor() },
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
      label: { show: true, formatter: l.linkType, fontSize: 10, color: getEdgeLabelColor() },
      lineStyle: { color: getEdgeColor(), width: 2, curveness: 0.1 },
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
          const d = params.data?.deviceData as NetworkDeviceItem | undefined
          if (!d) return escapeHtml(params.name)
          // 所有动态字段转义，防止备注/型号等内容注入 DOM
          return [
            `<b>${escapeHtml(topoDeviceName(d))}</b>`,
            `类型：${escapeHtml(d.deviceType)}`,
            `管理IP：${escapeHtml(d.managementIp) || '—'}`,
            `端口数：${d.portCount ?? '—'}`,
            `状态：${escapeHtml(d.status)}`,
            `位置：${escapeHtml(d.installLocation) || '—'}`,
          ].join('<br/>')
        }
        if (params.dataType === 'edge') {
          const l = params.data
          return [
            `<b>${escapeHtml(l.value)}</b>`,
            `${escapeHtml(l.sourceName)} → ${escapeHtml(l.targetName)}`,
            l.portInfo ? `端口：${escapeHtml(l.portInfo)}` : '',
          ].filter(Boolean).join('<br/>')
        }
        return escapeHtml(params.name)
      },
    },
    legend: [{ data: [...DEVICE_TYPES], bottom: 10, textStyle: { color: getEdgeLabelColor() } }],
    toolbox: { show: true, right: 20, feature: { restore: { title: '还原' } } },
    series: [{
      type: 'graph',
      layout: 'force',
      roam: true,
      draggable: true,
      label: { show: true },
      edgeLabel: { show: true, fontSize: 10, color: getEdgeLabelColor() },
      force: { repulsion: 300, edgeLength: [120, 200], gravity: 0.08, layoutAnimation: true },
      emphasis: { focus: 'adjacency', lineStyle: { width: 4 }, label: { fontSize: 13, fontWeight: 'bold' } },
      data: nodes,
      links: edges,
      categories,
    }],
  }
})

// —— 节点点击 → emit 给父组件 ——
function onChartClick(params: any) {
  if (params.dataType === 'node') {
    const d = params.data?.deviceData as NetworkDeviceItem | undefined
    if (d) {
      emit('node-click', d)
    }
  }
}
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

.chart-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-placeholder);
  font-size: var(--font-size-small);
}

.error-detail {
  color: var(--text-secondary);
  font-size: 12px;
  max-width: 300px;
  text-align: center;
  word-break: break-all;
}

.chart-empty-filtered {
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
</style>
