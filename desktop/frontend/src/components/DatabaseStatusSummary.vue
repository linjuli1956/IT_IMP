<script setup>
import { computed } from 'vue'

const props = defineProps({
  status: {
    type: Object,
    required: true,
  },
})

const statusMeta = computed(() => {
  const states = {
    initialized: {
      tagType: 'success',
      label: '已完成初始化',
      description: '数据库表结构已准备好，可以启动服务并登录使用。',
    },
    uninitialized: {
      tagType: 'warning',
      label: '尚未初始化',
      description: '请先确认数据库连接，再点击“初始化数据库”。',
    },
    connection_failed: {
      tagType: 'danger',
      label: '无法连接',
      description: '请检查数据库主机、端口、账号、密码和网络。',
    },
  }
  return states[props.status.status] || { tagType: 'info', label: '未知', description: '请刷新状态后重试。' }
})

const migrationDescription = computed(() => {
  const count = props.status.migrationCount || 0
  if (!count) return '尚未完成数据库结构版本步骤。'
  return `已完成 ${count} 个数据库结构版本步骤：建表、补充文件字段、补充发票 OCR 字段和费用分摊表。这不是业务数据数量。`
})
</script>

<template>
  <el-descriptions :column="1" border size="small">
    <el-descriptions-item label="数据库状态">
      <el-tag :type="statusMeta.tagType" size="small">{{ statusMeta.label }}</el-tag>
      <span class="status-message">{{ statusMeta.description }}</span>
    </el-descriptions-item>
    <el-descriptions-item label="结构版本">
      {{ migrationDescription }}
    </el-descriptions-item>
    <el-descriptions-item label="最近初始化时间">{{ status.lastInitTime || '尚未初始化' }}</el-descriptions-item>
    <el-descriptions-item label="最近升级时间">{{ status.lastUpgradeTime || '尚未升级' }}</el-descriptions-item>
  </el-descriptions>
</template>

<style scoped>
.status-message { margin-left: 8px; font-size: var(--font-size-small); color: var(--text-secondary); }
</style>
