<template>
  <div class="page-header">
    <div class="page-header-top">
      <div class="page-header-left">
        <div class="page-header-title">{{ title }}</div>
        <div v-if="subtitle" class="page-header-subtitle">{{ subtitle }}</div>
      </div>
      <div class="page-header-actions">
        <slot name="actions" />
      </div>
    </div>
    <p v-if="description" class="page-header-description">{{ description }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
  description?: string
}

defineProps<Props>()
</script>

<style scoped>
.page-header {
  padding-bottom: var(--spacing-page);
  border-bottom: 1px solid var(--border-lighter);
  margin-bottom: 20px;
}

.page-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-header-title {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--text-primary);
}

.page-header-subtitle {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.page-header-actions {
  display: flex;
  gap: var(--spacing-btn-gap);
  flex-shrink: 0;
}

.page-header-description {
  font-size: var(--font-size-body);
  color: var(--text-regular);
  line-height: 1.6;
  margin-top: 8px;
}
</style>
