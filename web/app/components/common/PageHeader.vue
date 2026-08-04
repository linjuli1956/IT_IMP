<template>
  <div class="page-header">
    <div class="page-header-title">{{ title }}</div>
    <div class="page-header-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string
}

defineProps<Props>()
</script>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.page-header-title {
  font-size: var(--font-size-title);
  font-weight: 600;
  color: var(--text-primary);
}

.page-header-actions {
  display: flex;
  gap: var(--spacing-btn-gap);
}
</style>
