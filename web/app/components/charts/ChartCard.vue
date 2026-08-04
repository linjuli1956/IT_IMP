<template>
  <div class="card chart-card">
    <div class="section-title">{{ title }}</div>
    <ClientOnly>
      <v-chart class="chart" :option="option" autoresize />
      <template #fallback>
        <div class="chart-loading">
          <el-icon size="32" color="var(--border-base)"><DataLine /></el-icon>
          <p>加载中...</p>
        </div>
      </template>
    </ClientOnly>
  </div>
</template>

<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, PieChart, BarChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { DataLine } from '@element-plus/icons-vue'

use([
  CanvasRenderer,
  LineChart,
  PieChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DataZoomComponent,
])

defineProps<{
  title: string
  option: Record<string, any>
}>()
</script>

<style scoped>
.chart-card {
  height: 280px;
  display: flex;
  flex-direction: column;
}

.chart {
  flex: 1;
  width: 100%;
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
</style>
