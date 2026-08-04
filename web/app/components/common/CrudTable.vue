<template>
  <div class="crud-table">
    <!-- 批量操作栏 -->
    <div v-if="showSelection && selectedRows.length > 0" class="batch-bar">
      <span class="batch-info">已选 {{ selectedRows.length }} 项</span>
      <el-button v-if="showBatchPrint" size="small" type="primary" @click="handleBatchPrint">
        批量打印
      </el-button>
      <el-button v-if="showBatchCopy" size="small" type="success" @click="handleBatchCopy">
        批量复制
      </el-button>
      <el-button size="small" type="danger" @click="handleBatchDelete">
        批量删除
      </el-button>
      <el-button size="small" @click="clearSelection">取消选择</el-button>
    </div>

    <el-table
      ref="tableRef"
      :data="data"
      v-loading="loading"
      border
      :stripe="stripe"
      :row-class-name="rowClassName"
      style="width: 100%"
      @selection-change="handleSelectionChange"
    >
      <el-table-column v-if="showSelection" type="selection" width="45" align="center" />
      <el-table-column type="index" label="序号" width="60" align="center" />
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
        :min-width="col.minWidth"
        :formatter="col.formatter"
        :align="col.align || 'left'"
        :filters="col.filters"
        :filter-method="col.filterMethod"
        show-overflow-tooltip
      >
        <template v-if="col.slot" #default="{ row }">
          <slot :name="col.slot" :row="row" />
        </template>
      </el-table-column>
      <el-table-column v-if="showActions" label="操作" :width="actionWidth" fixed="right" align="center">
        <template #default="{ row }">
          <slot name="actions" :row="row">
            <el-button size="small" @click="$emit('edit', row)">编辑</el-button>
            <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="showPagination" class="pagination-wrapper">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import type { ElTable } from 'element-plus'

interface Column {
  prop: string
  label: string
  width?: string | number
  minWidth?: string | number
  align?: 'left' | 'center' | 'right'
  formatter?: (row: any, column: any, value: any) => string
  slot?: string
  filters?: Array<{ text: string; value: any }>
  filterMethod?: (value: any, row: any, column: any) => boolean
}

interface Props {
  columns: Column[]
  data: any[]
  loading?: boolean
  showActions?: boolean
  showPagination?: boolean
  showSelection?: boolean
  showBatchPrint?: boolean
  showBatchCopy?: boolean
  total?: number
  actionWidth?: number
  rowClassName?: string | ((data: { row: any; rowIndex: number }) => string)
  stripe?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showActions: true,
  showPagination: false,
  showSelection: true,
  showBatchPrint: false,
  showBatchCopy: false,
  total: 0,
  actionWidth: 240,
  stripe: true,
})

const emit = defineEmits<{
  edit: [row: any]
  delete: [row: any]
  'batch-delete': [rows: any[]]
  'batch-print': [rows: any[]]
  'batch-copy': [rows: any[]]
  'page-change': [page: number, size: number]
}>()

const tableRef = ref<InstanceType<typeof ElTable>>()
const currentPage = ref(1)
const pageSize = ref(10)
const selectedRows = ref<any[]>([])

function handleSelectionChange(rows: any[]) {
  selectedRows.value = rows
}

function clearSelection() {
  tableRef.value?.clearSelection()
}

function handleDelete(row: any) {
  emit('delete', row)
}

function handleBatchDelete() {
  ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 项吗？`, '批量删除', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(() => {
    emit('batch-delete', selectedRows.value)
    clearSelection()
  }).catch(() => {})
}

function handleBatchPrint() {
  emit('batch-print', selectedRows.value)
  clearSelection()
}

function handleBatchCopy() {
  emit('batch-copy', selectedRows.value)
}

function handlePageChange() {
  emit('page-change', currentPage.value, pageSize.value)
}
</script>

<style scoped>
.crud-table {
  width: 100%;
}

.batch-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding: 8px 12px;
  background: var(--color-primary-light);
  border-radius: var(--radius-input);
}

.batch-info {
  font-size: var(--font-size-small);
  color: var(--text-regular);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
