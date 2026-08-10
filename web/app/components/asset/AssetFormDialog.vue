<template>
  <el-dialog :model-value="modelValue" :title="title" width="680px" destroy-on-close @update:model-value="emit('update:modelValue', $event)">
    <el-form :model="form" label-width="110px" ref="formRef">
      <el-row :gutter="16">
        <el-col v-for="f in visibleFields" :key="f.key" :span="f.width === 'full' ? 24 : 12">
          <el-form-item :label="f.label" :required="f.required" :prop="f.key">
            <!-- 自定义 slot 字段 -->
            <slot v-if="f.type === 'slot'" :name="f.key" :form="form" />
            <!-- 输入 -->
            <el-input v-else-if="f.type === 'input'" v-model="form[f.key]" :placeholder="f.placeholder" :disabled="isDisabled(f)" />
            <!-- 多行文本 -->
            <el-input v-else-if="f.type === 'textarea'" v-model="form[f.key]" type="textarea" :rows="2" :placeholder="f.placeholder" :disabled="isDisabled(f)" />
            <!-- 下拉 -->
            <el-select v-else-if="f.type === 'select'" v-model="form[f.key]" :placeholder="f.placeholder || '请选择'" clearable style="width: 100%" :disabled="isDisabled(f)">
              <el-option v-for="o in f.options || []" :key="String(o.value)" :label="o.label" :value="o.value" />
            </el-select>
            <!-- 数字 -->
            <el-input-number v-else-if="f.type === 'number'" v-model="form[f.key]" :min="f.min ?? 0" :precision="f.precision" :controls="false" style="width: 100%" :disabled="isDisabled(f)" />
            <!-- 日期 -->
            <el-date-picker v-else-if="f.type === 'date'" v-model="form[f.key]" type="date" value-format="YYYY-MM-DD" :placeholder="f.placeholder" clearable style="width: 100%" :disabled="isDisabled(f)" />
            <div v-if="f.tip" class="field-tip">{{ f.tip }}</div>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { ElMessage } from 'element-plus'
import { type AssetOptionValue } from '~/utils/asset-utils'

/** 表单字段配置 */
export interface AssetFieldConfig<T> {
  key: keyof T & string
  label: string
  type: 'input' | 'select' | 'number' | 'date' | 'textarea' | 'slot'
  required?: boolean
  options?: Array<{ label: string; value: AssetOptionValue }>
  min?: number
  precision?: number
  width?: 'half' | 'full'
  placeholder?: string
  tip?: string
  /** 自定义校验：返回错误消息或 null */
  validator?: (value: unknown, form: Record<string, any>) => string | null
  /** 提交前值转换（如空串→null） */
  normalize?: (value: unknown, form: Record<string, any>) => unknown
  /** 字段显示条件 */
  visibleWhen?: (form: Record<string, any>) => boolean
  /** 字段禁用条件 */
  disabledWhen?: (form: Record<string, any>) => boolean
}

const props = defineProps<{
  modelValue: boolean
  title: string
  fields: AssetFieldConfig<T>[]
  model: Partial<T>
  saving?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [visible: boolean]
  submit: [payload: Partial<T>]
}>()

// Props down / Events up：本地拷贝，不直接修改 props.model
const form = reactive<Record<string, any>>({})
watch(() => props.modelValue, (visible) => {
  if (!visible) return
  for (const f of props.fields) {
    form[f.key] = props.model[f.key] ?? (f.type === 'select' ? '' : f.type === 'number' ? undefined : '')
  }
}, { immediate: true })

const visibleFields = computed(() => props.fields.filter(f => !f.visibleWhen || f.visibleWhen(form)))
const saving = computed(() => props.saving ?? false)

function isDisabled(f: AssetFieldConfig<T>): boolean {
  return Boolean(f.disabledWhen?.(form))
}

async function handleSubmit() {
  // 只校验当前可见字段（visibleWhen 隐藏的字段不校验必填，也不提交，避免覆盖原值）
  for (const f of visibleFields.value) {
    if (f.required && (form[f.key] === undefined || form[f.key] === '' || form[f.key] === null)) {
      ElMessage.warning(`请填写${f.label}`)
      return
    }
    if (f.validator) {
      const err = f.validator(form[f.key], form)
      if (err) { ElMessage.warning(`${f.label}：${err}`); return }
    }
  }
  // 值转换后提交（只含可见字段；不修改 props）
  const payload: Record<string, any> = {}
  for (const f of visibleFields.value) {
    payload[f.key] = f.normalize ? f.normalize(form[f.key], form) : form[f.key]
  }
  emit('submit', payload as Partial<T>)
}
</script>

<style scoped>
.field-tip { font-size: var(--font-size-mini); color: var(--text-secondary); }
</style>
