<template>
  <div class="stat-card card" :style="{ borderLeftColor: color }">
    <div class="stat-icon" :style="{ background: bg }">
      <el-icon :size="24" :color="color">
        <component :is="icon" />
      </el-icon>
    </div>
    <div class="stat-info">
      <div class="stat-value" :style="{ color }">{{ value }}</div>
      <div class="stat-label">{{ label }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  color: string
  bg: string
  value: string | number
  label: string
}>()
</script>

<style scoped>
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 80px;
  padding: 0 16px;
  border-left: 4px solid transparent;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-card);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-info {
  flex: 1;
  min-width: 0;
}

.stat-value {
  font-size: var(--font-size-display);
  font-weight: 600;
  line-height: 1.2;
}

.stat-label {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
