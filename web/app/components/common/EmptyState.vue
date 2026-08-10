<template>
  <div class="empty-state">
    <el-icon class="empty-state-icon">
      <component :is="icon ?? Document" />
    </el-icon>
    <span class="empty-state-text">{{ description }}</span>
    <el-button v-if="actionText" type="primary" @click="emit('action')">
      {{ actionText }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { Document } from '@element-plus/icons-vue'

withDefaults(defineProps<{
  description?: string
  icon?: Component
  actionText?: string
}>(), {
  description: '暂无数据',
})

const emit = defineEmits<{
  (e: 'action'): void
}>()
</script>
