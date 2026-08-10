<template>
  <el-popover
    :placement="placement"
    :show-after="showAfter"
    :hide-after="hideAfter"
    :trigger="['hover', 'focus']"
    :width="maxWidth"
    :popper-class="'record-preview-popper' + (variant === 'light' ? ' record-preview-popper--light' : '')"
    popper-style="pointer-events: none;"
  >
    <template #reference>
      <slot name="reference">
        <span class="record-preview__trigger" tabindex="0" :aria-label="title || '详情预览'">{{ defaultText }}</span>
      </slot>
    </template>

    <div class="record-preview" :class="`record-preview--${variant}`" :style="{ maxWidth: maxWidth + 'px' }">
      <div v-if="title" class="record-preview__title">{{ title }}</div>
      <slot name="header" />
      <div v-for="row in visibleRows" :key="row.label" class="record-preview__row">
        <span class="record-preview__label">{{ row.label }}</span>
        <span class="record-preview__value" :class="row.tone ? `is-${row.tone}` : ''" :title="row.tone ? '' : String(row.value)">{{ display(row.value) }}</span>
      </div>
      <div v-if="truncatedCount > 0" class="record-preview__more">…其余 {{ truncatedCount }} 项见详情页</div>
      <slot name="default" />
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { formatPreviewValue, filterSensitiveRows, type PreviewRowLike } from '~/utils/asset-utils'

export type PreviewTone = 'default' | 'success' | 'warning' | 'danger' | 'info'

export interface PreviewRow extends PreviewRowLike {
  tone?: PreviewTone
  /** 敏感行：永远不渲染（即使 CSS 隐藏也不允许进入 DOM） */
  sensitive?: boolean
}

const props = withDefaults(defineProps<{
  title?: string
  rows?: PreviewRow[]
  defaultText?: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  showAfter?: number
  hideAfter?: number
  maxWidth?: number
  /** 快捷预览最大行数（超出部分提示见详情页，不静默丢字段） */
  maxRows?: number
  /** 视觉风格：light=浅色 Popover（默认），dark=深色 Tooltip */
  variant?: 'light' | 'dark'
}>(), {
  rows: () => [],
  defaultText: '',
  placement: 'bottom',
  showAfter: 300,
  hideAfter: 100,
  maxWidth: 340,
  maxRows: 8,
  variant: 'light',
})

/** 敏感行过滤：敏感字段不进 tooltip DOM */
const safeRows = computed(() => filterSensitiveRows(props.rows))

/** 限行：超过 maxRows 时提示剩余项数（详情页承载） */
const visibleRows = computed(() => safeRows.value.slice(0, props.maxRows))
const truncatedCount = computed(() => Math.max(0, safeRows.value.length - props.maxRows))

/** 空值统一显示 "—"；false/0 正常显示 */
function display(value: PreviewRowLike['value']): string {
  return formatPreviewValue(value)
}
</script>

<style scoped>
/* 触发元素视觉（轻微虚线下划线，符合现有链接语言；键盘可达） */
.record-preview__trigger {
  cursor: help;
  text-decoration: underline dotted;
  text-underline-offset: 3px;
  outline: none;
}
.record-preview__trigger:focus-visible {
  outline: 1px solid var(--color-primary);
  border-radius: var(--radius-small);
}
</style>

<style>
/* popper 纯展示：禁用指针事件，避免挡住下方触发元素 */
.record-preview-popper {
  pointer-events: none !important;
}

/* —— 浅色 Popover 风格（默认）—— */
.record-preview {
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.record-preview--light .record-preview__title {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--text-primary);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-lighter);
}
.record-preview--light .record-preview__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-form);
  font-size: var(--font-size-mini);
}
.record-preview--light .record-preview__label {
  color: var(--text-secondary);
  flex-shrink: 0;
}
.record-preview--light .record-preview__value {
  color: var(--text-primary);
  text-align: right;
  max-width: 200px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
}
.record-preview--light .record-preview__more {
  font-size: var(--font-size-micro);
  color: var(--text-placeholder);
}

/* tone 色值在浅色模式下使用深色系 */
.record-preview--light .record-preview__value.is-success { color: var(--color-success); }
.record-preview--light .record-preview__value.is-warning { color: var(--color-warning); }
.record-preview--light .record-preview__value.is-danger { color: var(--color-danger); }
.record-preview--light .record-preview__value.is-info { color: var(--color-info); }

/* —— 深色 Tooltip 风格（兼容旧引用）—— */
.record-preview--dark .record-preview__title {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--color-white);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}
.record-preview--dark .record-preview__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--spacing-form);
  font-size: var(--font-size-mini);
}
.record-preview--dark .record-preview__label {
  color: rgba(255, 255, 255, 0.65);
  flex-shrink: 0;
}
.record-preview--dark .record-preview__value {
  color: var(--color-white);
  text-align: right;
  max-width: 200px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
}
.record-preview--dark .record-preview__more {
  font-size: var(--font-size-micro);
  color: rgba(255, 255, 255, 0.5);
}
.record-preview--dark .record-preview__value.is-success { color: var(--color-success); }
.record-preview--dark .record-preview__value.is-warning { color: var(--color-warning); }
.record-preview--dark .record-preview__value.is-danger { color: var(--color-danger); }
.record-preview--dark .record-preview__value.is-info { color: var(--color-info); }
</style>
