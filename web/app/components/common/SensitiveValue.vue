<template>
  <div class="sensitive-value">
    <span class="value-text" :class="{ masked: !revealed }">
      {{ displayText }}
    </span>
    <el-icon v-if="canToggle" class="toggle-icon" :class="{ 'is-loading': loading }" @click="toggle">
      <Loading v-if="loading" />
      <View v-else-if="!revealed" />
      <Hide v-else />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { View, Hide, Loading } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { getApiErrorMessage } from '~/composables/useApi'

const props = defineProps<{
  /** 本地模式：预下发的明文值（仅用于非密字段，如账号） */
  value?: string
  /** 显式请求模式：点击眼睛时调用（如 /api/domains/:id/password），返回明文 */
  reveal?: () => Promise<string>
  /** 显式请求模式：是否已配置（未配置时不显示眼睛） */
  configured?: boolean
}>()

const revealed = ref(false)
const loading = ref(false)
const fetchedValue = ref('')

/** 是否显示眼睛按钮：本地模式有值即可切换；显式模式需已配置且提供 reveal */
const canToggle = computed(() => {
  if (props.reveal) return props.configured !== false
  return props.value !== undefined && props.value !== null
})

const displayText = computed(() => {
  if (revealed.value) {
    return fetchedValue.value || props.value || '—'
  }
  // 掩码态
  if (props.reveal) {
    if (props.configured === false) return '未配置'
    return '••••••••'
  }
  if (!props.value) return '—'
  if (props.value.length <= 8) return '••••••••'
  return props.value.substring(0, 4) + '••••••••' + props.value.substring(props.value.length - 4)
})

async function toggle() {
  // 本地模式：直接切换显隐
  if (!props.reveal) {
    revealed.value = !revealed.value
    return
  }
  // 显式模式：隐藏时请求明文，再次点击隐藏并丢弃
  if (revealed.value) {
    revealed.value = false
    fetchedValue.value = ''
    return
  }
  loading.value = true
  try {
    fetchedValue.value = await props.reveal()
    revealed.value = true
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.sensitive-value {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--font-size-small);
}

.value-text.masked {
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.toggle-icon {
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
}

.toggle-icon:hover {
  color: var(--color-primary);
}

.toggle-icon.is-loading {
  cursor: wait;
}
</style>
