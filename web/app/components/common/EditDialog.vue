<template>
  <el-dialog
    :model-value="modelValue"
    :title="title"
    :width="width"
    @close="handleClose"
  >
    <el-alert
      v-if="tip"
      :title="tip"
      type="info"
      :closable="false"
      show-icon
      style="margin-bottom: 16px"
    />
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-width="120px"
      @submit.prevent
    >
      <el-form-item
        v-for="field in fields"
        :key="field.prop"
        :label="field.label"
        :prop="field.prop"
      >
        <!-- 输入框 -->
        <el-input
          v-if="field.type === 'input' || !field.type"
          v-model="formData[field.prop]"
          :placeholder="field.placeholder || `请输入${field.label}`"
          :disabled="field.disabled"
        />
        <!-- 数字输入框 -->
        <el-input-number
          v-else-if="field.type === 'number'"
          v-model="formData[field.prop]"
          :min="field.min"
          :max="field.max"
          :step="field.step || 1"
          :disabled="field.disabled"
        />
        <!-- 文本域 -->
        <el-input
          v-else-if="field.type === 'textarea'"
          v-model="formData[field.prop]"
          type="textarea"
          :rows="field.rows || 3"
          :placeholder="field.placeholder || `请输入${field.label}`"
        />
        <!-- 下拉选择 -->
        <el-select
          v-else-if="field.type === 'select'"
          v-model="formData[field.prop]"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          :allow-create="field.allowCreate"
          filterable
          default-first-option
          style="width: 100%"
        >
          <el-option
            v-for="opt in field.options"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <!-- 日期选择 -->
        <el-date-picker
          v-else-if="field.type === 'date'"
          v-model="formData[field.prop]"
          type="date"
          value-format="YYYY-MM-DD"
          :placeholder="field.placeholder || `请选择${field.label}`"
          :disabled="field.disabled"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'

interface FieldOption {
  label: string
  value: any
}

interface Field {
  prop: string
  label: string
  type?: 'input' | 'number' | 'select' | 'date' | 'textarea'
  options?: FieldOption[]
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  rows?: number
  allowCreate?: boolean
}

interface Props {
  modelValue: boolean
  title: string
  fields: Field[]
  formData: Record<string, any>
  rules?: FormRules
  width?: string
  saving?: boolean
  tip?: string
}

const props = withDefaults(defineProps<Props>(), {
  width: '500px',
  saving: false,
  tip: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  save: [data: Record<string, any>]
}>()

const formRef = ref<FormInstance>()

function handleClose() {
  emit('update:modelValue', false)
}

async function handleSave() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    emit('save', { ...props.formData })
  } catch {
    // 验证失败，不关闭弹窗
  }
}
</script>
