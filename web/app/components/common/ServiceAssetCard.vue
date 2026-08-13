<!--
  ServiceAssetCard：服务型资产通用卡片（域名 / 小程序）。
  设计依据：docs/IT资产页面分型与交互规范.md §5.1 / §6.6 / §6.7
  v0.2 决策 3：编辑平铺为文字按钮，删除为红色文字操作，不保留只有编辑/删除的更多菜单
  - 点击卡片 → 打开 AssetDetailDrawer（emit click）
  - 右上角平铺编辑+删除文字按钮，@click.stop + @keydown.enter/space.stop 阻止误开抽屉
  - 敏感字段不传入本组件，仅在抽屉按需显示
  - 复用 token，禁止硬编码颜色
-->
<template>
  <div
    class="service-card"
    :class="{ 'service-card--selected': isSelected }"
    role="button"
    tabindex="0"
    :aria-label="`查看 ${title} 详情`"
    @click="emit('click')"
    @keydown.enter.prevent="emit('click')"
    @keydown.space.prevent="emit('click')"
  >
    <!-- 顶栏：标题 + 平铺操作按钮 -->
    <div class="service-card__head">
      <div class="service-card__title-wrap">
        <span class="service-card__title">{{ title }}</span>
        <span v-if="subtitle" class="service-card__subtitle">{{ subtitle }}</span>
      </div>
      <div v-if="canEdit" class="service-card__actions">
        <el-button text size="small" :aria-label="`编辑 ${title}`" @click.stop="emit('edit')" @keydown.enter.stop @keydown.space.stop>编辑</el-button>
        <el-button text size="small" type="danger" :aria-label="`删除 ${title}`" @click.stop="emit('delete')" @keydown.enter.stop @keydown.space.stop>删除</el-button>
      </div>
    </div>

    <!-- Tag 区：SSL 类型 / 状态 / 到期倒计时 -->
    <div v-if="$slots.tags || tags?.length" class="service-card__tags">
      <slot name="tags">
        <el-tag v-for="t in tags" :key="t.label" :type="t.type || 'info'" size="small">{{ t.label }}</el-tag>
      </slot>
    </div>

    <!-- 正文：副信息字段（负责人 / 备注 / 管理入口等） -->
    <div v-if="$slots.body || fields?.length" class="service-card__body">
      <slot name="body">
        <div v-for="f in fields" :key="f.label" class="service-card__field">
          <span class="service-card__field-label">{{ f.label }}</span>
          <span
            class="service-card__field-value"
            :class="{ 'service-card__field-link': f.link }"
            @click.stop="f.link && emit('click')"
          >{{ f.value || '—' }}</span>
        </div>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">

/** 服务型卡片 Tag（SSL 类型 / 状态 / 到期倒计时，字段级着色） */
export interface ServiceTag {
  label: string
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
}

/** 服务型卡片字段（副信息；敏感字段不在此声明，仅在抽屉显示） */
export interface ServiceField {
  label: string
  value?: string | null
  /** 管理入口等链接型字段，主题色 + 点击仍开抽屉 */
  link?: boolean
}

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  tags?: ServiceTag[]
  fields?: ServiceField[]
  canEdit?: boolean
  isSelected?: boolean
}>(), {
  canEdit: false,
  isSelected: false,
})

const emit = defineEmits<{
  click: []
  edit: []
  delete: []
}>()
</script>

<style scoped>
.service-card {
  background: var(--bg-card);
  border: 1px solid var(--border-lighter);
  border-radius: var(--radius-card);
  padding: var(--spacing-card);
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.service-card:hover {
  border-color: var(--color-primary-border);
  box-shadow: var(--shadow-card);
}
.service-card--selected {
  border-color: var(--color-primary);
}
.service-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.service-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.service-card__title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.service-card__title {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-card__subtitle {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-card__actions {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.service-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.service-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.service-card__field {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-small);
}
.service-card__field-label {
  color: var(--text-secondary);
  flex-shrink: 0;
  min-width: 64px;
}
.service-card__field-value {
  color: var(--text-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.service-card__field-link {
  color: var(--color-primary);
  cursor: pointer;
}
</style>
