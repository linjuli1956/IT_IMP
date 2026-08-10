<!--
  CalibrationWorkbench：电子秤校准工作台（聚合视图）。
  设计依据：docs/IT资产页面分型与交互规范.md §7
  - 四状态卡：逾期/今天(红) · 1-30天(橙) · 31-90天(黄) · >90天(绿)，点击过滤列表
  - 分组口径（与 getCalibrationInfo 一致）：仅 status=正常 参与
    · overdue：overdue === true（含今天应校准 / 已逾期）
    · soon：!overdue && days !== null && days <= 30
    · approaching：!overdue && days !== null && days > 30 && days <= 90
    · normal：!overdue && days !== null && days > 90
  - 聚合卡按紧迫层级分色（danger/warning/caution/success）
-->
<template>
  <div class="calib-workbench">
    <div
      class="calib-card calib-card--danger"
      :class="{ 'calib-card--active': active === 'overdue' }"
      tabindex="0"
      role="button"
      :aria-label="`筛选逾期校准电子秤，共 ${overdueCount} 台`"
      @click="emit('select', 'overdue')"
      @keydown.enter.prevent="emit('select', 'overdue')"
    >
      <el-icon class="calib-card__icon"><WarningFilled /></el-icon>
      <div class="calib-card__main">
        <span class="calib-card__value">{{ overdueCount }}</span>
        <span class="calib-card__label">逾期 / 今天</span>
      </div>
    </div>

    <div
      class="calib-card calib-card--warning"
      :class="{ 'calib-card--active': active === 'soon' }"
      tabindex="0"
      role="button"
      :aria-label="`筛选30天内校准电子秤，共 ${soonCount} 台`"
      @click="emit('select', 'soon')"
      @keydown.enter.prevent="emit('select', 'soon')"
    >
      <el-icon class="calib-card__icon"><Clock /></el-icon>
      <div class="calib-card__main">
        <span class="calib-card__value">{{ soonCount }}</span>
        <span class="calib-card__label">1–30 天</span>
      </div>
    </div>

    <div
      class="calib-card calib-card--caution"
      :class="{ 'calib-card--active': active === 'approaching' }"
      tabindex="0"
      role="button"
      :aria-label="`筛选31到90天内校准电子秤，共 ${approachingCount} 台`"
      @click="emit('select', 'approaching')"
      @keydown.enter.prevent="emit('select', 'approaching')"
    >
      <el-icon class="calib-card__icon"><Timer /></el-icon>
      <div class="calib-card__main">
        <span class="calib-card__value">{{ approachingCount }}</span>
        <span class="calib-card__label">31–90 天</span>
      </div>
    </div>

    <div
      class="calib-card calib-card--success"
      :class="{ 'calib-card--active': active === 'normal' }"
      tabindex="0"
      role="button"
      :aria-label="`筛选校准正常电子秤，共 ${normalCount} 台`"
      @click="emit('select', 'normal')"
      @keydown.enter.prevent="emit('select', 'normal')"
    >
      <el-icon class="calib-card__icon"><CircleCheck /></el-icon>
      <div class="calib-card__main">
        <span class="calib-card__value">{{ normalCount }}</span>
        <span class="calib-card__label">正常</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { WarningFilled, Clock, Timer, CircleCheck } from '@element-plus/icons-vue'
import { getCalibrationInfo } from '~/utils/asset-utils'
import type { ScaleItem } from '~/types/scale'

const props = defineProps<{
  scales: ScaleItem[]
  /** 当前激活的过滤状态（null=无过滤） */
  active?: 'overdue' | 'soon' | 'approaching' | 'normal' | null
}>()

const emit = defineEmits<{
  select: [status: 'overdue' | 'soon' | 'approaching' | 'normal']
}>()

/** 仅 status=正常 参与校准提醒（与 getCalibrationInfo 一致） */
const participating = computed(() => props.scales.filter(s => s.status === '正常'))

const overdueCount = computed(() =>
  participating.value.filter(s => getCalibrationInfo(s.nextCalibrationDate, s.status).overdue).length,
)
const soonCount = computed(() =>
  participating.value.filter((s) => {
    const c = getCalibrationInfo(s.nextCalibrationDate, s.status)
    return !c.overdue && c.days !== null && c.days <= 30
  }).length,
)
const approachingCount = computed(() =>
  participating.value.filter((s) => {
    const c = getCalibrationInfo(s.nextCalibrationDate, s.status)
    return !c.overdue && c.days !== null && c.days > 30 && c.days <= 90
  }).length,
)
const normalCount = computed(() =>
  participating.value.filter((s) => {
    const c = getCalibrationInfo(s.nextCalibrationDate, s.status)
    return !c.overdue && c.days !== null && c.days > 90
  }).length,
)
</script>

<style scoped>
.calib-workbench {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--spacing-card);
}
.calib-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-card);
  border-radius: var(--radius-card);
  border: 1px solid var(--border-lighter);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.calib-card:hover { box-shadow: var(--shadow-card); }
.calib-card:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }

.calib-card--danger { background: var(--color-danger-light); }
.calib-card--danger .calib-card__icon { color: var(--color-danger); }
.calib-card--warning { background: var(--color-warning-light); }
.calib-card--warning .calib-card__icon { color: var(--color-warning); }
.calib-card--caution { background: var(--color-caution-light); }
.calib-card--caution .calib-card__icon { color: var(--color-caution); }
.calib-card--success { background: var(--color-success-light); }
.calib-card--success .calib-card__icon { color: var(--color-success); }

.calib-card--active.calib-card--danger { border-color: var(--color-danger); }
.calib-card--active.calib-card--warning { border-color: var(--color-warning); }
.calib-card--active.calib-card--caution { border-color: var(--color-caution); }
.calib-card--active.calib-card--success { border-color: var(--color-success); }

.calib-card__icon {
  font-size: var(--font-size-icon);
  flex-shrink: 0;
}
.calib-card__main {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.calib-card__value {
  font-size: var(--font-size-display);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1;
}
.calib-card__label {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}
</style>
