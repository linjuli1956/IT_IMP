<!--
  ActionButton：全局统一语义动作按钮组件。
  基于 tokens.css action token 体系，禁止各页面用 type/hex/局部 CSS 临时拼按钮。

  variant 语义：
  - close: 关闭/取消/返回 — 中性灰描边
  - primary: 新增/保存/编辑/确认 — 品牌蓝色实心
  - danger: 删除/解除绑定/高风险确认 — 红色实心
  - credential: 密码管理/凭据查看 — 紫色柔和实心（默认 Lock 图标）
  - external: 外部管理入口 — 橙色实心（默认 Link 图标，需传 href）
  - info: 查看详情/跳转详情页 — 蓝色轻量

  用法示例：
  <ActionButton variant="primary" @click="handleSave">保存</ActionButton>
  <ActionButton variant="external" :href="url">进入管理</ActionButton>
  <ActionButton variant="credential" size="small">密码管理</ActionButton>
-->
<template>
  <a
    v-if="href"
    :href="disabled ? undefined : href"
    target="_blank"
    rel="noopener"
    :class="['action-btn', `action-btn--${variant}`, `action-btn--${size}`, { 'is-disabled': disabled }]"
    :aria-disabled="disabled"
  >
    <el-icon v-if="loading" class="is-loading"><Loading /></el-icon>
    <el-icon v-else-if="resolvedIcon" class="action-btn__icon"><component :is="resolvedIcon" /></el-icon>
    <span class="action-btn__text"><slot /></span>
  </a>
  <button
    v-else
    type="button"
    :disabled="disabled || loading"
    :class="['action-btn', `action-btn--${variant}`, `action-btn--${size}`, { 'is-disabled': disabled }]"
    @click="handleClick"
  >
    <el-icon v-if="loading" class="is-loading"><Loading /></el-icon>
    <el-icon v-else-if="resolvedIcon" class="action-btn__icon"><component :is="resolvedIcon" /></el-icon>
    <span class="action-btn__text"><slot /></span>
  </button>
</template>

<script setup lang="ts">
import type { Component } from 'vue'
import { Loading, Lock, Link as LinkIcon } from '@element-plus/icons-vue'

const props = withDefaults(defineProps<{
  variant: 'close' | 'primary' | 'danger' | 'credential' | 'external' | 'info'
  size?: 'default' | 'small'
  loading?: boolean
  disabled?: boolean
  href?: string
  icon?: Component
}>(), {
  size: 'default',
  loading: false,
  disabled: false,
})

const emit = defineEmits<{
  click: [event: MouseEvent]
}>()

/** 每个变体的默认图标 */
const defaultIcons: Partial<Record<string, Component>> = {
  credential: Lock,
  external: LinkIcon,
}

const resolvedIcon = computed(() => props.icon || defaultIcons[props.variant] || null)

function handleClick(event: MouseEvent) {
  if (props.disabled || props.loading) return
  emit('click', event)
}
</script>

<style scoped>
/* —— 基础样式 —— */
.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--action-btn-icon-gap);
  height: var(--action-btn-height);
  padding: 0 16px;
  font-size: var(--action-btn-font-size);
  font-weight: 500;
  line-height: 1;
  border-radius: var(--action-btn-radius);
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  text-decoration: none;
  user-select: none;
  transition: background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.action-btn--small {
  height: var(--action-btn-height-sm);
  padding: 0 12px;
  font-size: var(--action-btn-font-size-sm);
}

.action-btn__icon {
  font-size: inherit;
}

.action-btn__text {
  display: inline-block;
}

/* —— Variant: close — 中性灰描边 —— */
.action-btn--close {
  color: var(--action-close-fg);
  background: var(--action-close-bg);
  border-color: var(--action-close-border);
}
.action-btn--close:hover:not(.is-disabled) {
  color: var(--action-close-hover-fg);
  background: var(--action-close-hover-bg);
  border-color: var(--action-close-hover-border);
}

/* —— Variant: primary — 品牌蓝色实心 —— */
.action-btn--primary {
  color: var(--action-primary-fg);
  background: var(--action-primary-bg);
  border-color: var(--action-primary-border);
}
.action-btn--primary:hover:not(.is-disabled) {
  background: var(--action-primary-hover-bg);
  border-color: var(--action-primary-hover-border);
}
.action-btn--primary:active:not(.is-disabled) {
  background: var(--action-primary-active-bg);
  border-color: var(--action-primary-active-border);
}

/* —— Variant: danger — 红色实心 —— */
.action-btn--danger {
  color: var(--action-danger-fg);
  background: var(--action-danger-bg);
  border-color: var(--action-danger-border);
}
.action-btn--danger:hover:not(.is-disabled) {
  background: var(--action-danger-hover-bg);
  border-color: var(--action-danger-hover-border);
}
.action-btn--danger:active:not(.is-disabled) {
  background: var(--action-danger-active-bg);
  border-color: var(--action-danger-active-border);
}

/* —— Variant: credential — 紫色柔和实心 —— */
.action-btn--credential {
  color: var(--action-credential-fg);
  background: var(--action-credential-bg);
  border-color: var(--action-credential-border);
}
.action-btn--credential:hover:not(.is-disabled) {
  background: var(--action-credential-hover-bg);
  border-color: var(--action-credential-hover-border);
}
.action-btn--credential:active:not(.is-disabled) {
  background: var(--action-credential-active-bg);
  border-color: var(--action-credential-active-border);
}

/* —— Variant: external — 橙色实心 —— */
.action-btn--external {
  color: var(--action-external-fg);
  background: var(--action-external-bg);
  border-color: var(--action-external-border);
}
.action-btn--external:hover:not(.is-disabled) {
  background: var(--action-external-hover-bg);
  border-color: var(--action-external-hover-border);
}
.action-btn--external:active:not(.is-disabled) {
  background: var(--action-external-active-bg);
  border-color: var(--action-external-active-border);
}

/* —— Variant: info — 蓝色轻量 —— */
.action-btn--info {
  color: var(--action-info-fg);
  background: var(--action-info-bg);
  border-color: var(--action-info-border);
}
.action-btn--info:hover:not(.is-disabled) {
  color: var(--action-info-hover-fg);
  background: var(--action-info-hover-bg);
  border-color: var(--action-info-hover-border);
}
.action-btn--info:active:not(.is-disabled) {
  color: var(--action-info-active-fg);
  background: var(--action-info-active-bg);
  border-color: var(--action-info-active-border);
}

/* —— Disabled —— */
.action-btn.is-disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* —— Focus visible（语义色匹配） —— */
.action-btn:focus-visible {
  outline: 2px solid var(--action-primary-bg);
  outline-offset: 2px;
}
.action-btn--close:focus-visible { outline-color: var(--text-secondary); }
.action-btn--danger:focus-visible { outline-color: var(--action-danger-bg); }
.action-btn--credential:focus-visible { outline-color: var(--action-credential-bg); }
.action-btn--external:focus-visible { outline-color: var(--action-external-bg); }
.action-btn--info:focus-visible { outline-color: var(--action-info-fg); }
</style>
