<template>
  <div class="asset-filters">
    <el-input
      v-if="keyword"
      v-model="keywordValue"
      :placeholder="keyword.placeholder || '搜索...'"
      :aria-label="keyword.placeholder || '搜索'"
      clearable
      style="width: 220px"
      @input="debouncedChange"
    />
    <template v-for="f in fields" :key="f.key">
      <span class="filter-label">{{ f.label }}</span>
      <el-select
        :model-value="model[f.key]"
        :placeholder="f.placeholder || '全部'"
        :aria-label="f.label"
        clearable
        style="width: 130px"
        @update:model-value="(v: AssetOptionValue) => handleSelect(f, v)"
      >
        <el-option v-for="o in f.options" :key="String(o.value)" :label="o.label" :value="o.value" />
      </el-select>
    </template>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { useDebounceFn } from '@vueuse/core'
import { isEmptyValue, type AssetOptionValue } from '~/utils/asset-utils'

/** 筛选选项 */
export interface AssetFilterOption {
  label: string
  value: AssetOptionValue
}

/** 筛选字段配置（key 与数据模型关联） */
export interface AssetFilterField<T> {
  key: keyof T & string
  label: string
  options: AssetFilterOption[]
  placeholder?: string
}

/** 关键字字段（key 与数据模型关联） */
export interface AssetKeywordField<T> {
  key: keyof T & string
  placeholder?: string
}

const props = defineProps<{
  fields: AssetFilterField<T>[]
  keyword?: AssetKeywordField<T>
  model: Partial<T>
}>()

const emit = defineEmits<{
  update: [filters: Partial<T>]
}>()

const fields = computed(() => props.fields)
const keywordValue = ref('')

/** 关键字输入防抖 300ms 后触发（清空判断保留 false/0；关键字为字符串） */
const debouncedChange = useDebounceFn(() => {
  if (!props.keyword) return
  const patch: Partial<T> = {}
  ;(patch as Record<string, unknown>)[props.keyword.key] = isEmptyValue(keywordValue.value) ? undefined : keywordValue.value
  emit('update', patch)
}, 300)

function handleSelect(field: AssetFilterField<T>, value: AssetOptionValue) {
  const patch: Partial<T> = {}
  ;(patch as Record<string, unknown>)[field.key] = isEmptyValue(value) ? undefined : value
  emit('update', patch)
}
</script>

<style scoped>
.asset-filters { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; }
.filter-label { font-size: var(--font-size-small); color: var(--text-secondary); }
</style>
