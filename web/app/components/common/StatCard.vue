<template>
  <div class="stat-card card" :style="{ '--stat-color': color, '--stat-bg': bg }">
    <div class="stat-icon">
      <el-icon :size="24">
        <component :is="icon" />
      </el-icon>
    </div>
    <div class="stat-info">
      <div class="stat-value">{{ value }}</div>
      <div v-if="trend !== undefined" class="stat-trend" :class="trend >= 0 ? 'is-up' : 'is-down'">
        <el-icon :size="12">
          <CaretTop v-if="trend >= 0" />
          <CaretBottom v-else />
        </el-icon>
        <span>{{ Math.abs(trend) }}%</span>
      </div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { CaretTop, CaretBottom } from '@element-plus/icons-vue'

defineProps<{
  icon: Component
  color: string
  bg: string
  value: string | number
  label: string
  trend?: number
}>()
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 80px;
  padding: 0 16px;
  border-left: 4px solid var(--stat-color, transparent);
  transition: box-shadow var(--transition-base);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--stat-bg);
  color: var(--stat-color);
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: var(--font-size-display);
  font-weight: 600;
  line-height: 1.2;
  color: var(--stat-color);
}

.stat-trend {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--font-size-mini);
  font-weight: 600;
  margin-top: 2px;
}

.stat-trend.is-up {
  color: var(--color-success);
}

.stat-trend.is-down {
  color: var(--color-danger);
}

.stat-label {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
