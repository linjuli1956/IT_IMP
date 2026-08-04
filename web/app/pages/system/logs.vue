<script setup lang="ts">
import OperationLogFilters from '~/components/system/OperationLogFilters.vue'
import OperationLogTable from '~/components/system/OperationLogTable.vue'
import { type LogFilters, useLogData } from '~/composables/useLogData'

const { logList, loading, total, filterOptions, fetchLogs, fetchLogOptions, clearLogs } = useLogData()

const filters = ref<LogFilters>({
  dateRange: null,
  username: '',
  action: '',
  module: '',
})
const currentPage = shallowRef(1)
const pageSize = shallowRef(20)
const isAdmin = shallowRef(false)

function buildQuery() {
  return {
    startDate: filters.value.dateRange?.[0],
    endDate: filters.value.dateRange?.[1],
    username: filters.value.username || undefined,
    action: filters.value.action || undefined,
    module: filters.value.module || undefined,
    page: currentPage.value,
    pageSize: pageSize.value,
  }
}

async function loadLogs() {
  await fetchLogs(buildQuery())
}

function handleFiltersUpdate(nextFilters: LogFilters) {
  filters.value = nextFilters
}

function handleSearch() {
  currentPage.value = 1
  loadLogs()
}

function handlePageChange(page: number) {
  currentPage.value = page
  loadLogs()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  currentPage.value = 1
  loadLogs()
}

function resetFilters() {
  filters.value = { dateRange: null, username: '', action: '', module: '' }
  currentPage.value = 1
  loadLogs()
}

async function handleClearLogs() {
  const cleared = await clearLogs()
  if (!cleared) return

  currentPage.value = 1
  await Promise.all([loadLogs(), fetchLogOptions()])
}

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      isAdmin.value = JSON.parse(rawUser).role === '管理员'
    } catch {
      isAdmin.value = false
    }
  }

  await Promise.all([loadLogs(), fetchLogOptions()])
})
</script>

<template>
  <div class="page-container">
    <PageHeader title="操作日志" />

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 记录系统中的关键操作，包括新增、编辑、删除、登录、导出和打印。</p>
        <p>2. 可按时间范围、用户、操作类型和模块筛选，并支持分页查看。</p>
        <p>3. 所有登录用户可查看；仅管理员可清空日志，清空操作本身会保留审计记录。</p>
      </div>
    </el-alert>

    <OperationLogFilters
      :filters="filters"
      :options="filterOptions"
      :is-admin="isAdmin"
      @update:filters="handleFiltersUpdate"
      @search="handleSearch"
      @reset="resetFilters"
      @clear="handleClearLogs"
    />

    <OperationLogTable
      :logs="logList"
      :loading="loading"
      :total="total"
      :current-page="currentPage"
      :page-size="pageSize"
      @page-change="handlePageChange"
      @page-size-change="handlePageSizeChange"
    />
  </div>
</template>

<style scoped>
</style>
