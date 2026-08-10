<template>
  <div class="asset-table">
    <el-alert v-if="error" type="error" :closable="false" show-icon :title="error" class="asset-table__error" />
    <el-table
      v-else-if="loading || data.length > 0"
      :data="data"
      v-loading="loading"
      border
      size="small"
      style="width: 100%"
    >
      <el-table-column v-for="col in columns" :key="col.key" :prop="col.virtual ? undefined : col.key" :label="col.label"
        :width="col.width" :min-width="col.minWidth" :align="col.align || 'left'" show-overflow-tooltip>
        <template v-if="col.slot" #default="{ row }">
          <slot :name="col.slot" :row="row" />
        </template>
        <template v-else-if="col.type === 'status'" #default="{ row }">
          <el-tag :type="getAssetStatusTagType(String(row[col.key]))" size="small">{{ row[col.key] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="canEdit" label="操作" :width="actionWidth" fixed="right" align="center">
        <template #default="{ row }">
          <slot name="actions" :row="row">
            <el-button size="small" @click="$emit('edit', row as T)">编辑</el-button>
            <el-button size="small" type="danger" @click="$emit('delete', row as T)">删除</el-button>
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-else-if="!loading" :description="emptyText || '暂无数据'" :image-size="60" />

    <div v-if="!error && data.length > 0" class="asset-table__pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="currentPageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        @change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { getAssetStatusTagType } from '~/utils/asset-utils'
import type { AssetOptionValue } from '~/utils/asset-utils'

/** 列公共配置 */
export interface AssetColumnBase {
  label: string
  width?: number
  minWidth?: number
  align?: 'left' | 'center' | 'right'
  type?: 'status'   // status 列自动渲染统一状态标签
  slot?: string     // 自定义 slot 名（slot 渲染时用）
}

/** 表格列配置：数据列 key 与模型关联；虚拟列（组合/自定义）显式声明 virtual */
export type AssetColumn<T> = AssetColumnBase & (
  | { virtual: true; key: string }
  | { virtual?: false; key: keyof T & string }
)

const props = defineProps<{
  columns: AssetColumn<T>[]
  data: T[]
  total: number
  loading?: boolean
  page: number
  pageSize: number
  canEdit?: boolean
  actionWidth?: number
  error?: string
  emptyText?: string
}>()

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  'page-change': [page: number, size: number]
  edit: [row: T]
  delete: [row: T]
}>()

const currentPage = computed({
  get: () => props.page,
  set: (v: number) => emit('update:page', v),
})
const currentPageSize = computed({
  get: () => props.pageSize,
  set: (v: number) => emit('update:pageSize', v),
})

function handlePageChange(page: number, size: number) {
  emit('page-change', page, size)
}
</script>

<style scoped>
.asset-table__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--spacing-card);
}
.asset-table__error { margin-bottom: var(--spacing-card); }
</style>
