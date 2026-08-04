<template>
  <div class="page-container">
    <PageHeader title="操作日志" />

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 记录系统中所有关键操作，包括新增/编辑/删除/登录/导出/打印</p>
        <p>2. 可按时间范围、用户、操作类型、模块筛选查看</p>
        <p>3. 日志为只读，管理员可清除全部日志（清除操作本身会被记录）</p>
        <p>4. 日志记录系统所有关键操作，数据实时从数据库读取</p>
      </div>
    </el-alert>

    <!-- 筛选区 -->
    <div class="card filter-bar">
      <el-date-picker
        v-model="filterDateRange"
        type="daterange"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        value-format="YYYY-MM-DD"
        style="width: 260px"
      />
      <el-select v-model="filterUser" placeholder="操作用户" clearable style="width: 140px">
        <el-option v-for="u in userOptions" :key="u" :label="u" :value="u" />
      </el-select>
      <el-select v-model="filterAction" placeholder="操作类型" clearable style="width: 120px">
        <el-option v-for="a in actionOptions" :key="a" :label="a" :value="a" />
      </el-select>
      <el-select v-model="filterModule" placeholder="模块" clearable style="width: 140px">
        <el-option v-for="m in moduleOptions" :key="m" :label="m" :value="m" />
      </el-select>
      <el-button @click="clearFilters">重置</el-button>
      <el-button type="danger" plain @click="clearLogs">清除日志</el-button>
    </div>

    <!-- 列表 -->
    <div class="card">
      <el-table :data="filteredLogs" v-loading="loading" border stripe size="default">
        <el-table-column prop="time" label="操作时间" width="170" />
        <el-table-column prop="username" label="用户" width="100" />
        <el-table-column prop="action" label="操作类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="getActionTagType(row.action)">{{ row.action }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="120" />
        <el-table-column prop="content" label="操作内容" min-width="280" show-overflow-tooltip />
        <el-table-column prop="ip" label="IP地址" width="140" />
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useLogData } from '~/composables/useLogData'

const { logList, loading, fetchLogs, clearLogs } = useLogData()

onMounted(() => fetchLogs())

// 动态提取唯一值，用于筛选项（从实际日志数据中提取）
const userOptions = computed(() =>
  [...new Set(logList.value.map(log => log.username))]
)
const actionOptions = computed(() =>
  [...new Set(logList.value.map(log => log.action))]
)
const moduleOptions = computed(() =>
  [...new Set(logList.value.map(log => log.module))]
)

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

function getActionTagType(action: string): TagType {
  const map: Record<string, TagType> = {
    '新增': 'success',
    '编辑': 'warning',
    '删除': 'danger',
    '登录': 'info',
    '导出': 'primary',
    '打印': 'primary',
  }
  return map[action] || 'info'
}

// 筛选（前端过滤，数据量不大）
const filterDateRange = ref<[string, string] | null>(null)
const filterUser = ref('')
const filterAction = ref('')
const filterModule = ref('')

const filteredLogs = computed(() => {
  return logList.value.filter(log => {
    if (filterDateRange.value && filterDateRange.value[0] && filterDateRange.value[1]) {
      const logDate = log.time.split(' ')[0]
      if (logDate < filterDateRange.value[0] || logDate > filterDateRange.value[1]) return false
    }
    if (filterUser.value && log.username !== filterUser.value) return false
    if (filterAction.value && log.action !== filterAction.value) return false
    if (filterModule.value && log.module !== filterModule.value) return false
    return true
  })
})

function clearFilters() {
  filterDateRange.value = null
  filterUser.value = ''
  filterAction.value = ''
  filterModule.value = ''
}
</script>

<style scoped>
</style>
