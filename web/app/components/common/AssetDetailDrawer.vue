<!--
  AssetDetailDrawer：基于 el-drawer 的通用右侧详情抽屉。
  响应式尺寸：≥1440→560px，1200~1439→520px，<1200→92vw(最大520px)
  footer sticky 固定底部；主体独立滚动。
-->
<template>
  <el-drawer
    v-model="visible"
    :title="title"
    :size="drawerSize"
    direction="rtl"
    :destroy-on-close="true"
    append-to-body
    @close="emit('close')"
  >
    <div class="drawer-body">
      <!-- 身份与状态 -->
      <div v-if="$slots.header" class="drawer-section">
        <slot name="header" />
      </div>

      <!-- 默认插槽：主体内容 -->
      <slot />
    </div>

    <!-- 底部操作区 sticky 固定在抽屉底部 -->
    <div v-if="$slots.footer" class="drawer-footer">
      <slot name="footer" />
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  canEdit?: boolean
}>(), {
  title: '详情',
  canEdit: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

/** 响应式抽屉宽度 */
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440)
const drawerSize = computed(() => {
  const w = windowWidth.value
  if (w >= 1440) return '560px'
  if (w >= 1200) return '520px'
  return '92vw'
})

function onResize() { windowWidth.value = window.innerWidth }

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize)
  }
})
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onResize)
  }
})
</script>

<style scoped>
.drawer-body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-card);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.drawer-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.drawer-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: var(--spacing-card);
  border-top: 1px solid var(--border-lighter);
  position: sticky;
  bottom: 0;
  background: var(--bg-card);
}
</style>
