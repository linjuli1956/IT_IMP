<!--
  ActionButton 按钮矩阵展示页（开发用）
  展示所有 variant × state 组合，用于视觉审计与截图。
  路由：/dev/action-buttons（需登录，不加入侧边栏）
-->
<template>
  <div class="page-container">
    <h1 class="page-title">ActionButton 按钮矩阵</h1>
    <p class="showcase-desc">功能语义着色按钮体系 — 6 种 variant × 4 种 state。hover / focus 状态请用鼠标交互查看。</p>

    <!-- 1. 实心按钮矩阵 -->
    <div class="card showcase-section">
      <div class="section-title">实心按钮（Solid / Light）</div>
      <table class="showcase-table">
        <thead>
          <tr>
            <th class="col-label">语义</th>
            <th>默认</th>
            <th>Disabled</th>
            <th>Loading</th>
            <th>外链 (href)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in solidRows" :key="row.variant">
            <td class="col-label">
              <span class="label-variant">{{ row.variant }}</span>
              <span class="label-desc">{{ row.desc }}</span>
            </td>
            <td>
              <ActionButton :variant="row.variant" size="small">{{ row.label }}</ActionButton>
            </td>
            <td>
              <ActionButton :variant="row.variant" size="small" disabled>{{ row.label }}</ActionButton>
            </td>
            <td>
              <ActionButton v-if="row.canLoad" :variant="row.variant" size="small" loading>{{ row.label }}</ActionButton>
              <span v-else class="text-secondary">—</span>
            </td>
            <td>
              <ActionButton v-if="row.href" :variant="row.variant" size="small" :href="row.href">{{ row.linkLabel || row.label }}</ActionButton>
              <span v-else class="text-secondary">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 2. 文字按钮（表格行操作） -->
    <div class="card showcase-section">
      <div class="section-title">文字按钮（表格行操作）</div>
      <div class="showcase-row-actions">
        <button class="action-text action-text--primary">编辑</button>
        <button class="action-text action-text--danger">删除</button>
        <span class="action-text action-text--info">更多<el-icon class="action-text__caret"><ArrowDown /></el-icon></span>
        <span class="divider">|</span>
        <button class="action-text action-text--credential">密码管理</button>
        <button class="action-text action-text--external">进入管理</button>
        <button class="action-text action-text--info">打开详情页</button>
        <span class="divider">|</span>
        <button class="action-text action-text--close">关闭</button>
      </div>
    </div>

    <!-- 3. Drawer Footer 样板 -->
    <div class="card showcase-section">
      <div class="section-title">Drawer Footer 样板（服务器）</div>
      <div class="showcase-footer">
        <ActionButton variant="close" size="small">关闭</ActionButton>
        <ActionButton variant="primary" size="small" :icon="Edit">编辑</ActionButton>
        <ActionButton variant="credential" size="small">密码管理</ActionButton>
        <ActionButton variant="external" size="small" href="https://example.invalid">进入管理</ActionButton>
        <ActionButton variant="info" size="small">打开详情页</ActionButton>
      </div>
      <div class="showcase-footer-note">
        canEdit + 有管理地址 = 5 个操作 → "打开详情页" 收进"更多"下拉（详见服务器页面实际效果）
      </div>
    </div>

    <!-- 4. 尺寸对比 -->
    <div class="card showcase-section">
      <div class="section-title">尺寸对比</div>
      <div class="showcase-sizes">
        <ActionButton variant="primary">默认尺寸 (32px)</ActionButton>
        <ActionButton variant="primary" size="small">小尺寸 (28px)</ActionButton>
        <ActionButton variant="danger">默认尺寸</ActionButton>
        <ActionButton variant="danger" size="small">小尺寸</ActionButton>
      </div>
    </div>

    <!-- 5. Token 色值参考 -->
    <div class="card showcase-section">
      <div class="section-title">Action Token 色值</div>
      <div class="showcase-tokens">
        <div v-for="t in tokenList" :key="t.name" class="token-chip">
          <span class="token-swatch" :style="{ background: t.bg, color: t.fg, borderColor: t.border }">{{ t.label }}</span>
          <code class="token-name">{{ t.name }}</code>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ArrowDown, Edit } from '@element-plus/icons-vue'

const solidRows = [
  { variant: 'close' as const, label: '关闭', desc: '关闭/取消/返回 — 中性灰描边', canLoad: false, href: '' },
  { variant: 'primary' as const, label: '保存', desc: '新增/保存/编辑/确认 — 品牌蓝色实心', canLoad: true, href: '' },
  { variant: 'danger' as const, label: '删除', desc: '删除/解除绑定/高风险 — 红色实心', canLoad: true, href: '' },
  { variant: 'credential' as const, label: '密码管理', desc: '密码/凭据 — 紫色柔和实心', canLoad: true, href: '' },
  { variant: 'external' as const, label: '进入管理', desc: '外部管理入口 — 橙色实心', canLoad: false, href: 'https://example.invalid', linkLabel: '进入管理' },
  { variant: 'info' as const, label: '打开详情页', desc: '查看详情 — 蓝色轻量', canLoad: false, href: '' },
]

const tokenList = [
  { name: '--action-close', label: '关闭', bg: 'var(--action-close-bg)', fg: 'var(--action-close-fg)', border: 'var(--action-close-border)' },
  { name: '--action-primary', label: '主操作', bg: 'var(--action-primary-bg)', fg: 'var(--action-primary-fg)', border: 'var(--action-primary-border)' },
  { name: '--action-danger', label: '删除', bg: 'var(--action-danger-bg)', fg: 'var(--action-danger-fg)', border: 'var(--action-danger-border)' },
  { name: '--action-credential', label: '凭据', bg: 'var(--action-credential-bg)', fg: 'var(--action-credential-fg)', border: 'var(--action-credential-border)' },
  { name: '--action-external', label: '外链', bg: 'var(--action-external-bg)', fg: 'var(--action-external-fg)', border: 'var(--action-external-border)' },
  { name: '--action-info', label: '详情', bg: 'var(--action-info-bg)', fg: 'var(--action-info-fg)', border: 'var(--action-info-border)' },
]
</script>

<style scoped>
.showcase-desc {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-card);
}

.showcase-section {
  margin-bottom: var(--spacing-card);
}

.showcase-table {
  width: 100%;
  border-collapse: collapse;
}
.showcase-table th {
  text-align: left;
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-lighter);
}
.showcase-table td {
  padding: 12px;
  border-bottom: 1px solid var(--border-lighter);
}
.col-label {
  width: 200px;
}
.label-variant {
  display: block;
  font-weight: 600;
  font-size: var(--font-size-small);
  color: var(--text-primary);
}
.label-desc {
  display: block;
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
  margin-top: 2px;
}

.showcase-row-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 0;
}
.divider {
  color: var(--border-base);
  margin: 0 8px;
}

.showcase-footer {
  display: flex;
  align-items: center;
  gap: var(--drawer-footer-gap);
  padding: var(--spacing-card) 0;
  border-top: 1px solid var(--border-lighter);
}
.showcase-footer-note {
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
  margin-top: 8px;
}

.showcase-sizes {
  display: flex;
  align-items: center;
  gap: var(--action-btn-gap);
  padding: 8px 0;
  flex-wrap: wrap;
}

.showcase-tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 8px 0;
}
.token-chip {
  display: flex;
  align-items: center;
  gap: 8px;
}
.token-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 28px;
  padding: 0 12px;
  font-size: var(--font-size-small);
  font-weight: 500;
  border-radius: var(--radius-btn);
  border: 1px solid;
}
.token-name {
  font-family: var(--font-family-mono);
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
}
</style>
