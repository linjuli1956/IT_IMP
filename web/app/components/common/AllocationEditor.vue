<template>
  <el-dialog
    v-model="visible"
    :title="`分摊明细 — ${itemTitle}`"
    width="700px"
    :close-on-click-modal="false"
    append-to-body
  >
    <el-alert type="info" :closable="false" show-icon style="margin-bottom: var(--spacing-btn-gap);">
      <template #title>{{ valueHint }}</template>
    </el-alert>

    <el-table :data="localAllocations" border stripe size="small" style="width: 100%">
      <el-table-column label="门店" min-width="160">
        <template #default="{ row }">
          <el-select v-model="row.store" size="small" placeholder="选择门店" filterable allow-create style="width: 100%">
            <el-option v-for="s in storeOptions" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="承担部门" min-width="180">
        <template #default="{ row }">
          <el-select v-model="row.dept" size="small" multiple filterable allow-create default-first-option placeholder="选择部门" style="width: 100%">
            <el-option v-for="d in deptOptions" :key="d" :label="d" :value="d" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column :label="valueLabel" width="140">
        <template #default="{ row }">
          <el-input-number v-model="row.value" size="small" :min="0" :precision="2" controls-position="right" style="width: 100%" />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="100">
        <template #default="{ row }">
          <el-input v-model="row.remark" size="small" placeholder="备注" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button size="small" type="danger" link @click="removeRow($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div style="margin-top: var(--spacing-btn-gap);">
      <el-button @click="addRow" plain size="small">
        <el-icon><Plus /></el-icon>
        添加分摊行
      </el-button>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="handleSave">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import type { FeeAllocation } from '~/types/fee-scheme'

interface Props {
  modelValue: boolean
  allocations: FeeAllocation[]
  allocationMode: string
  itemTitle: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [val: boolean]
  save: [allocations: FeeAllocation[]]
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const { storeOptions } = useStoreData()

// 部门选项（从门店列表提取，去重）
const deptOptions = computed(() => {
  const depts = new Set<string>()
  for (const s of storeOptions.value) {
    if (s.label) depts.add(s.label)
  }
  return Array.from(depts)
})

// 本地副本（编辑时不影响外部）
const localAllocations = ref<FeeAllocation[]>([])

watch(visible, (val) => {
  if (val) {
    localAllocations.value = props.allocations.map(a => ({ ...a, dept: [...a.dept] }))
  }
})

// 值列标签
const valueLabel = computed(() => {
  switch (props.allocationMode) {
    case 'fixed': return '金额(元)'
    case 'ratio': return '百分比(%)'
    case 'quantity': return '数量'
    case 'manual': return '默认值'
    default: return '值'
  }
})

// 提示信息
const valueHint = computed(() => {
  switch (props.allocationMode) {
    case 'fixed': return '固定金额：每个门店分摊的固定金额'
    case 'ratio': return '比例分摊：填写百分比，金额 × 百分比 = 分摊金额'
    case 'quantity': return '按数量分摊：填写数量，金额 × 数量/总数量 = 分摊金额'
    case 'manual': return '手动输入：生成计提表时由用户手动输入各门店金额'
    default: return ''
  }
})

function addRow() {
  localAllocations.value.push({
    store: '',
    dept: [],
    value: 0,
    remark: '',
  })
}

function removeRow(index: number) {
  localAllocations.value.splice(index, 1)
}

function handleSave() {
  emit('save', localAllocations.value.map(a => ({ ...a, dept: [...a.dept] })))
  visible.value = false
}
</script>
