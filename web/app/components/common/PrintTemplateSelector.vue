<template>
  <el-dialog
    :model-value="modelValue"
    title="选择打印模板"
    width="440px"
    :close-on-click-modal="false"
    @update:model-value="handleModelValueChange"
  >
    <div class="template-options" role="radiogroup" aria-label="选择打印模板">
      <div
        v-for="option in options"
        :key="option.value"
        class="template-option"
        :class="{ 'is-selected': selectedTemplate === option.value }"
        role="radio"
        :aria-checked="selectedTemplate === option.value"
        tabindex="0"
        @click="select(option.value)"
        @keydown.enter.prevent="select(option.value)"
        @keydown.space.prevent="select(option.value)"
      >
        <el-icon class="template-option-icon"><component :is="option.icon" /></el-icon>
        <div class="template-option-body">
          <div class="template-option-name">{{ option.name }}</div>
          <div class="template-option-desc">{{ option.desc }}</div>
        </div>
        <el-icon v-if="selectedTemplate === option.value" class="template-option-check"><Check /></el-icon>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" @click="handleConfirm">确认打印</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { Printer, Document, Check } from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { ref, watch } from 'vue'

type PrintTemplate = 'a5' | 'a4'

interface Props {
  modelValue?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: [template: PrintTemplate]
  cancel: []
}>()

/** 本地受控选中态；弹窗打开时重置为默认 A5 */
const selectedTemplate = ref<PrintTemplate>('a5')

interface TemplateOption {
  value: PrintTemplate
  name: string
  desc: string
  icon: Component
}

const options: TemplateOption[] = [
  {
    value: 'a5',
    name: 'A5（自动压缩）',
    desc: 'A4 纸上输出横向 A5 版式，打印后可裁切；批量每页两份',
    icon: Printer,
  },
  {
    value: 'a4',
    name: 'A4（自动分页）',
    desc: 'A4 纵向正常字号，内容自然分页，每份独立开始',
    icon: Document,
  },
]

function select(value: PrintTemplate) {
  selectedTemplate.value = value
}

/** 确认：先关闭 v-model 再发 confirm，两步保持同一次「确认打印」点击调用链内，不触发 cancel */
function handleConfirm() {
  emit('update:modelValue', false)
  emit('confirm', selectedTemplate.value)
}

/** 取消按钮：发 cancel 并关闭 */
function handleCancel() {
  emit('cancel')
  emit('update:modelValue', false)
}

/**
 * 右上角关闭 / ESC：由 el-dialog 内部触发 update:modelValue(false)，
 * 视为取消（只发 cancel，不发 confirm）。
 */
function handleModelValueChange(value: boolean) {
  if (!value) {
    emit('cancel')
  }
  emit('update:modelValue', value)
}

// 弹窗打开时重置选中态为默认 A5
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      selectedTemplate.value = 'a5'
    }
  },
)
</script>

<style scoped>
.template-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 0 8px;
  width: 100%;
}

/* 受控卡片式单选：普通块级元素，宽度被 Dialog 容器约束，1366 宽度下不横向溢出 */
.template-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid #DCDFE6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s, background-color 0.2s;
}

.template-option:hover {
  border-color: #B3D8FF;
}

.template-option:focus-visible {
  border-color: #409EFF;
  box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
}

/* 选中态：浅蓝背景 + 蓝色边框/图标，仅卡片内部，不整条铺满 */
.template-option.is-selected {
  background-color: #ECF5FF;
  border-color: #409EFF;
}

.template-option-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 20px;
  color: #909399;
}

.template-option.is-selected .template-option-icon {
  color: #409EFF;
}

.template-option-body {
  flex: 1;
  min-width: 0;
}

.template-option-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.template-option-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
  word-wrap: break-word;
  white-space: normal;
}

.template-option-check {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 16px;
  color: #409EFF;
}
</style>
