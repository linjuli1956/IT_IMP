<template>
  <div class="sensitive-value">
    <span class="value-text" :class="{ masked: !revealed }">
      {{ !revealed ? maskValue(value) : (value || '—') }}
    </span>
    <el-icon class="toggle-icon" @click="revealed = !revealed">
      <View v-if="!revealed" />
      <Hide v-else />
    </el-icon>
  </div>
</template>

<script setup lang="ts">
import { View, Hide } from '@element-plus/icons-vue'

const props = defineProps<{
  value?: string
}>()

const revealed = ref(false)

function maskValue(val?: string): string {
  if (!val) return '—'
  if (val.length <= 8) return '••••••••'
  return val.substring(0, 4) + '••••••••' + val.substring(val.length - 4)
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
</style>
