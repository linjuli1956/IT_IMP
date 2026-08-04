<template>
  <div class="fee-item-editor">
    <el-table :data="items" border stripe size="small" style="width: 100%">
      <el-table-column label="费用类型" width="140">
        <template #default="{ row }">
          <el-select v-model="row.feeType" size="small" placeholder="选择类型" filterable allow-create default-first-option style="width: 100%">
            <el-option v-for="t in feeTypePresets" :key="t" :label="t" :value="t" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="费用名称" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" placeholder="如商务宽带套餐" />
        </template>
      </el-table-column>
      <el-table-column label="金额来源" width="120">
        <template #default="{ row }">
          <el-select v-model="row.amountSource" size="small" style="width: 100%" @change="onAmountSourceChange(row)">
            <el-option v-for="o in amountSourceOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="固定金额" width="120">
        <template #default="{ row }">
          <el-input-number
            v-model="row.fixedAmount"
            size="small"
            :min="0"
            :precision="2"
            controls-position="right"
            :disabled="row.amountSource !== 'fixed'"
            style="width: 100%"
          />
        </template>
      </el-table-column>
      <el-table-column label="分摊方式" width="120">
        <template #default="{ row }">
          <el-select v-model="row.allocationMode" size="small" style="width: 100%">
            <el-option v-for="o in allocationModeOptions" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="分摊明细" width="100" align="center">
        <template #default="{ row, $index }">
          <el-button size="small" link type="primary" @click="openAllocationEditor($index)">
            {{ row.allocations?.length || 0 }} 行
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="100">
        <template #default="{ row }">
          <el-input v-model="row.remark" size="small" placeholder="备注" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="70" align="center">
        <template #default="{ $index }">
          <el-button size="small" type="danger" link @click="removeItem($index)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="add-bar">
      <el-button @click="addItem" plain size="small">
        <el-icon><Plus /></el-icon>
        添加费用项
      </el-button>
    </div>

    <AllocationEditor
      v-model="allocationVisible"
      :allocations="currentAllocations"
      :allocation-mode="currentAllocationMode"
      :item-title="currentItemTitle"
      @save="handleAllocationSave"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { FEE_TYPE_PRESETS, ALLOCATION_MODE_OPTIONS, AMOUNT_SOURCE_OPTIONS } from '~/types/fee-scheme'
import type { FeeItem, FeeAllocation } from '~/types/fee-scheme'

interface Props {
  modelValue: FeeItem[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [val: FeeItem[]]
}>()

// 使用 v-model 双向绑定
const items = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

const feeTypePresets = FEE_TYPE_PRESETS
const allocationModeOptions = ALLOCATION_MODE_OPTIONS
const amountSourceOptions = AMOUNT_SOURCE_OPTIONS

// 分摊明细编辑器状态
const allocationVisible = ref(false)
const currentEditIndex = ref(-1)
const currentAllocations = ref<FeeAllocation[]>([])
const currentAllocationMode = ref('fixed')
const currentItemTitle = ref('')

function addItem() {
  items.value.push({
    feeType: '宽带',
    name: '',
    amountSource: 'fixed',
    fixedAmount: 0,
    allocationMode: 'fixed',
    allocations: [],
    remark: '',
  })
}

/** amountSource='manual' 时强制 allocationMode='manual'，避免 ratio/quantity 产生 0 值 */
function onAmountSourceChange(row: any) {
  if (row.amountSource === 'manual') {
    row.allocationMode = 'manual'
  }
}

function removeItem(index: number) {
  items.value.splice(index, 1)
}

function openAllocationEditor(index: number) {
  const item = items.value[index]
  currentEditIndex.value = index
  currentAllocations.value = item.allocations || []
  currentAllocationMode.value = item.allocationMode
  currentItemTitle.value = item.name || item.feeType || `费用项${index + 1}`
  allocationVisible.value = true
}

function handleAllocationSave(allocations: FeeAllocation[]) {
  if (currentEditIndex.value >= 0) {
    items.value[currentEditIndex.value].allocations = allocations
  }
  currentEditIndex.value = -1
}
</script>

<style scoped>
.add-bar {
  margin-top: var(--spacing-btn-gap);
}
</style>
