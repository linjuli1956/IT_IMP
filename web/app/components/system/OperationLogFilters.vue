<script setup lang="ts">
import type { LogFilterOptions, LogFilters } from '~/composables/useLogData'

interface Props {
  filters: LogFilters
  options: LogFilterOptions
  isAdmin: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:filters': [filters: LogFilters]
  search: []
  reset: []
  clear: []
}>()

function updateFilters(patch: Partial<LogFilters>) {
  emit('update:filters', { ...props.filters, ...patch })
  emit('search')
}

function updateDateRange(value: [string, string] | null) {
  updateFilters({ dateRange: value })
}
</script>

<template>
  <div class="filter-bar card">
    <el-date-picker
      :model-value="filters.dateRange"
      type="daterange"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      value-format="YYYY-MM-DD"
      style="width: 260px"
      @update:model-value="updateDateRange"
    />
    <el-select
      :model-value="filters.username"
      placeholder="操作用户"
      clearable
      filterable
      style="width: 140px"
      @update:model-value="updateFilters({ username: $event })"
    >
      <el-option v-for="username in options.usernames" :key="username" :label="username" :value="username" />
    </el-select>
    <el-select
      :model-value="filters.action"
      placeholder="操作类型"
      clearable
      style="width: 120px"
      @update:model-value="updateFilters({ action: $event })"
    >
      <el-option v-for="action in options.actions" :key="action" :label="action" :value="action" />
    </el-select>
    <el-select
      :model-value="filters.module"
      placeholder="模块"
      clearable
      style="width: 140px"
      @update:model-value="updateFilters({ module: $event })"
    >
      <el-option v-for="module in options.modules" :key="module" :label="module" :value="module" />
    </el-select>
    <el-button @click="emit('reset')">重置</el-button>
    <el-button v-if="isAdmin" type="danger" plain @click="emit('clear')">清除日志</el-button>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}
</style>
