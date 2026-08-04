<script setup lang="ts">
import type { OperationLog } from '~/composables/useLogData'

interface Props {
  logs: OperationLog[]
  loading: boolean
  total: number
  currentPage: number
  pageSize: number
}

defineProps<Props>()
const emit = defineEmits<{
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
}>()

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

function getActionTagType(action: string): TagType {
  const map: Record<string, TagType> = {
    新增: 'success',
    编辑: 'warning',
    删除: 'danger',
    登录: 'info',
    导出: 'primary',
    打印: 'primary',
  }
  return map[action] || 'info'
}
</script>

<template>
  <div class="card">
    <el-table :data="logs" :loading="loading" border stripe size="default">
      <el-table-column prop="time" label="操作时间" width="180" />
      <el-table-column prop="username" label="用户" width="110" />
      <el-table-column prop="action" label="操作类型" width="100" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="getActionTagType(row.action)">{{ row.action }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="module" label="模块" width="130" />
      <el-table-column prop="content" label="操作内容" min-width="280" show-overflow-tooltip />
      <el-table-column prop="ip" label="IP 地址" width="140" />
    </el-table>

    <div class="pagination-wrapper">
      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @current-change="emit('pageChange', $event)"
        @size-change="emit('pageSizeChange', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
