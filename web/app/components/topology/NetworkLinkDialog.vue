<template>
  <el-dialog :model-value="modelValue" title="新增连线" width="500px" :destroy-on-close="true" @update:model-value="emit('update:modelValue', $event)">
    <el-form :model="formData" label-width="90px" size="default">
      <!-- 上游设备：有 sourceDevice 时固定显示，无时可选 -->
      <el-form-item v-if="sourceDevice" label="上游设备">
        <span>{{ sourceName }}</span>
      </el-form-item>
      <el-form-item v-else label="上游设备" required>
        <el-select v-model="formData.sourceDeviceId" placeholder="选择设备" filterable style="width: 100%" @change="onSourceChange">
          <el-option
            v-for="d in sourceOptions"
            :key="d.id"
            :label="d.label"
            :value="d.id"
          />
        </el-select>
      </el-form-item>
      <!-- 下游设备 -->
      <el-form-item label="下游设备" required>
        <el-select v-model="formData.targetDeviceId" placeholder="选择同门店设备" filterable style="width: 100%" :disabled="!formData.sourceDeviceId">
          <el-option
            v-for="d in targetOptions"
            :key="d.id"
            :label="d.label"
            :value="d.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="源端口">
        <el-input v-model="formData.sourcePort" placeholder="如 Gig1/0/1（可选）" />
      </el-form-item>
      <el-form-item label="目标端口">
        <el-input v-model="formData.targetPort" placeholder="如 Gig0/1（可选）" />
      </el-form-item>
      <el-form-item label="连接类型" required>
        <el-select v-model="formData.linkType" style="width: 100%">
          <el-option v-for="t in linkTypes" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="formData.remark" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import type { NetworkDeviceItem } from '~/types/network-device'

// —— Props ——
const props = defineProps<{
  modelValue: boolean
  sourceDevice: NetworkDeviceItem | null
  devices: NetworkDeviceItem[]
  loading?: boolean
}>()

// —— Emits ——
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit': [data: {
    sourceDeviceId: number
    targetDeviceId: number
    sourcePort: string
    targetPort: string
    linkType: string
    remark: string
  }]
}>()

// —— 连接类型选项 ——
const linkTypes = ['上联', '级联', '直连', '其他']

// —— 表单数据 ——
const formData = reactive({
  sourceDeviceId: 0,
  targetDeviceId: null as number | null,
  sourcePort: '',
  targetPort: '',
  linkType: '直连',
  remark: '',
})

// —— 设备名格式化 ——
function deviceName(d: NetworkDeviceItem): string {
  const parts = [d.brand, d.model].filter(Boolean)
  return parts.length ? parts.join(' ') : `未命名${d.deviceType}`
}

// —— 源设备名称（固定模式时显示） ——
const sourceName = computed(() => {
  const d = props.sourceDevice
  if (!d) return ''
  return deviceName(d)
})

// —— 上游设备选项（仅在 sourceDevice 为 null 时使用） ——
const sourceOptions = computed(() => {
  if (props.sourceDevice) return []
  return props.devices.map(d => ({ id: d.id, label: deviceName(d) }))
})

// —— 当前选中的上游设备（固定模式用 prop，可选模式用表单） ——
const selectedSourceDevice = computed<NetworkDeviceItem | null>(() => {
  if (props.sourceDevice) return props.sourceDevice
  return props.devices.find(d => d.id === formData.sourceDeviceId) || null
})

// —— 下游设备选项：同门店、排除上游 ——
const targetOptions = computed(() => {
  const d = selectedSourceDevice.value
  if (!d) return []
  return props.devices
    .filter(x => x.storeId === d.storeId && x.id !== d.id)
    .map(x => ({ id: x.id, label: deviceName(x) }))
})

// —— 上游设备切换时清空下游 ——
function onSourceChange() {
  formData.targetDeviceId = null
}

// —— 打开时初始化表单 ——
watch(() => props.modelValue, (visible) => {
  if (visible) {
    formData.sourceDeviceId = props.sourceDevice?.id || 0
    formData.targetDeviceId = null
    formData.sourcePort = ''
    formData.targetPort = ''
    formData.linkType = '直连'
    formData.remark = ''
  }
})

// —— 提交表单 ——
function handleSubmit() {
  if (!formData.sourceDeviceId) {
    ElMessage.warning('请选择上游设备')
    return
  }
  if (!formData.targetDeviceId) {
    ElMessage.warning('请选择下游设备')
    return
  }
  emit('submit', {
    sourceDeviceId: formData.sourceDeviceId,
    targetDeviceId: formData.targetDeviceId,
    sourcePort: formData.sourcePort,
    targetPort: formData.targetPort,
    linkType: formData.linkType,
    remark: formData.remark,
  })
}
</script>
