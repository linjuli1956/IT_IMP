<template>
  <div
    class="server-host-card"
    :class="[serverToneClass(server), { 'is-selected': isSelected }]"
    @click="$emit('click', server)"
  >
    <!-- 头部：名称(hover预览) → 平台 Tag → 状态 Tag → 编辑/更多 -->
    <div class="card-header">
      <RecordPreviewTooltip :rows="hostPreviewRows" :title="server.name" placement="bottom" :max-rows="6" :max-width="360" variant="light">
        <template #reference>
          <span class="card-name" tabindex="0" :aria-label="server.name">{{ server.name }}</span>
        </template>
      </RecordPreviewTooltip>
      <span v-if="tone.platform" class="platform-tag" :class="tone.platform === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ tone.platform }}</span>
      <el-tag :type="statusTagType" size="small" effect="light">{{ server.status }}</el-tag>
      <div v-if="canEdit" class="card-actions" @click.stop>
        <el-button size="small" @click="$emit('edit', server)">编辑</el-button>
        <el-dropdown trigger="click" @command="(cmd: string) => cmd === 'delete' && $emit('delete', server)">
          <el-button size="small" text>更多<el-icon><ArrowDown /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="delete" style="color: var(--color-danger)">删除</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 网络信息 -->
    <div class="card-meta">
      <div class="meta-item meta-item--internal"><el-icon><Monitor /></el-icon><span class="meta-label">内网：</span><span class="ip-value">{{ server.internalIp || '—' }}</span></div>
      <div class="meta-item meta-item--external"><el-icon><Connection /></el-icon><span class="meta-label">外网：</span><span class="ip-value">{{ server.externalIp || '—' }}</span></div>
    </div>

    <!-- 硬件规格 -->
    <div class="card-specs">
      <div class="spec-item"><span class="spec-label spec-label--cpu">CPU</span><span class="spec-value">{{ specCpu }}</span></div>
      <div class="spec-item"><span class="spec-label spec-label--memory">内存</span><span class="spec-value">{{ server.memorySize || '—' }}</span></div>
      <div class="spec-item"><span class="spec-label spec-label--disk">系统盘</span><span class="spec-value">{{ server.systemDiskSize || '—' }}</span></div>
      <div class="spec-item"><span class="spec-label spec-label--disk">数据盘</span><span class="spec-value">{{ server.dataDiskSize || '—' }}</span></div>
    </div>

    <!-- VM 摘要区：hover/focus 触发 VM 列表预览，点击打开宿主机 Drawer -->
    <div v-if="vmChildren.length > 0" class="vm-summary" @click.stop="$emit('click', server)">
      <RecordPreviewTooltip :rows="vmListPreviewRows" title="虚拟机列表" placement="bottom" :max-rows="8" :max-width="380" variant="light">
        <template #reference>
          <div class="vm-summary-trigger" tabindex="0" role="button" aria-label="查看虚拟机明细">
            <div class="vm-summary-header">
              <span class="vm-summary-count">虚拟机 <span class="vm-num-total">{{ vmChildren.length }}</span> 台 · 运行 <span class="vm-num-running">{{ vmRunning }}</span><span v-if="vmStopped > 0"> · 停用 <span class="vm-num-stopped">{{ vmStopped }}</span></span></span>
              <span class="vm-summary-link">查看 VM 明细</span>
            </div>
            <div class="vm-summary-list">
              <div v-for="vm in previewVms" :key="vm.id" class="vm-summary-item">
                <span class="vm-summary-name">{{ vm.name }}</span>
                <span class="vm-summary-ip">{{ vm.internalIp || '—' }}</span>
              </div>
            </div>
            <div v-if="moreCount > 0" class="vm-summary-more">+{{ moreCount }} 台虚拟机</div>
          </div>
        </template>
      </RecordPreviewTooltip>
    </div>
    <div v-else class="vm-summary vm-empty">无虚拟机</div>

    <!-- 底部 -->
    <div class="card-footer">
      <span class="vm-count">{{ server.vmCount ?? 0 }} 台虚拟机 · {{ server.serverType }}</span>
      <a v-if="server.manageUrl" :href="server.manageUrl" target="_blank" rel="noopener" class="go-manage" @click.stop>
        进入管理 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Connection, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import type { ServerListItem } from '~/types/server'
import { serverVisualTone, serverToneClass } from '~/utils/server-visual-tone'
import { buildHostPreviewRows, buildVmListPreviewRows } from '~/utils/server-preview'

const props = defineProps<{
  /** 物理机/宿主机（含可选 children VM） */
  server: ServerListItem & { children?: ServerListItem[] }
  canEdit: boolean
  isSelected?: boolean
}>()

defineEmits<{
  click: [row: typeof props.server]
  edit: [row: typeof props.server]
  delete: [row: typeof props.server]
}>()

const tone = computed(() => serverVisualTone(props.server))

/** 宿主名称 hover：只展示物理机自身信息 */
const hostPreviewRows = computed(() => buildHostPreviewRows(props.server, []))

/** VM 摘要区 hover：展示 VM 列表 */
const vmListPreviewRows = computed(() => buildVmListPreviewRows(props.server.children || []))

const statusTagType = computed(() => {
  switch (props.server.status) {
    case '正常': return 'success'
    case '停用': return 'info'
    case '报废': return 'danger'
    default: return 'info'
  }
})

const specCpu = computed(() => {
  const model = props.server.cpuModel || ''
  const cores = props.server.cpuCores ? `${props.server.cpuCores}核` : ''
  return [model, cores].filter(Boolean).join(' · ') || '—'
})

const vmChildren = computed(() => props.server.children || [])
const vmRunning = computed(() => vmChildren.value.filter(v => v.status === '正常').length)
const vmStopped = computed(() => vmChildren.value.length - vmRunning.value)

/** 卡片内展示前 2 台 VM */
const MAX_CARD_VMS = 2
const previewVms = computed(() => vmChildren.value.slice(0, MAX_CARD_VMS))
const moreCount = computed(() => Math.max(0, vmChildren.value.length - MAX_CARD_VMS))
</script>

<style scoped>
.server-host-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-card);
  border: 1px solid var(--border-lighter);
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  background: var(--bg-card);
}

/* —— 平台 Tone 底色 —— */
.server-host-card.server-tone-pve {
  background: var(--tone-pve-bg);
  border-color: var(--tone-pve-border);
}
.server-host-card.server-tone-esxi {
  background: var(--tone-esxi-bg);
  border-color: var(--tone-esxi-border);
}
.server-host-card.server-tone-aliyun {
  background: var(--tone-aliyun-bg);
  border-color: var(--tone-aliyun-border);
}
.server-host-card.server-tone-tencent {
  background: var(--tone-tencent-bg);
  border-color: var(--tone-tencent-border);
}
.server-host-card.server-tone-huawei {
  background: var(--tone-huawei-bg);
  border-color: var(--tone-huawei-border);
}
.server-host-card.server-tone-local {
  background: var(--tone-local-bg);
  border-color: var(--tone-local-border);
}
.server-host-card.server-tone-other {
  background: var(--tone-other-bg);
  border-color: var(--tone-other-border);
}

.server-host-card:hover { box-shadow: var(--shadow-card); }
.server-host-card.is-selected { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-border); }

.card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-name { font-size: var(--font-size-subtitle); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 240px; cursor: pointer; }
.card-actions { margin-left: auto; display: flex; align-items: center; gap: 4px; }

.card-meta { display: flex; flex-direction: column; gap: 6px; }
.meta-item { display: flex; align-items: center; gap: 6px; font-size: var(--font-size-small); color: var(--text-regular); }
.meta-item--internal .el-icon { color: var(--color-info); }
.meta-item--external .el-icon { color: var(--color-warning); }
.meta-label { color: var(--text-secondary); flex-shrink: 0; }
.ip-value { font-family: var(--font-family-mono); color: var(--text-primary); }

.card-specs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; background: rgba(255, 255, 255, 0.6); border-radius: var(--radius-input); padding: 10px 12px; }
.spec-item { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; min-width: 0; }
.spec-label { font-size: var(--font-size-micro); color: var(--text-secondary); flex-shrink: 0; }
.spec-label--cpu { color: var(--spec-cpu); }
.spec-label--memory { color: var(--spec-memory); }
.spec-label--disk { color: var(--spec-disk); }
.spec-value { font-size: var(--font-size-small); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* —— VM 摘要区 —— */
.vm-summary {
  border-radius: var(--radius-input);
  background: rgba(255, 255, 255, 0.5);
  padding: 10px 12px;
}
.vm-summary-trigger {
  outline: none;
  border-radius: var(--radius-small);
  padding: 2px 4px;
  margin: -2px -4px;
}
.vm-summary-trigger:focus-visible {
  box-shadow: 0 0 0 2px var(--color-primary-border);
}
.vm-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.vm-summary-count {
  font-size: var(--font-size-small);
  font-weight: 600;
  color: var(--text-primary);
}
.vm-num-total { color: var(--color-primary); }
.vm-num-running { color: var(--color-success); }
.vm-num-stopped { color: var(--color-info); }
.vm-summary-link {
  font-size: var(--font-size-mini);
  color: var(--color-primary);
  white-space: nowrap;
  flex-shrink: 0;
}
.vm-summary-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.vm-summary-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: var(--font-size-mini);
  color: var(--text-regular);
}
.vm-summary-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.vm-summary-ip {
  color: var(--text-secondary);
  white-space: nowrap;
  margin-left: auto;
}
.vm-summary-more {
  font-size: var(--font-size-mini);
  color: var(--color-primary);
  margin-top: 4px;
}
.vm-empty { font-size: var(--font-size-small); color: var(--text-secondary); }

.card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--border-lighter); padding-top: 10px; }
.vm-count { font-size: var(--font-size-micro); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.go-manage { display: inline-flex; align-items: center; gap: 2px; font-size: var(--font-size-small); color: var(--color-primary); text-decoration: none; flex-shrink: 0; }
.go-manage:hover { text-decoration: underline; }

/* 平台 Tag 样式 */
.platform-tag {
  display: inline-flex; align-items: center; justify-content: center;
  font-size: var(--font-size-micro); font-weight: 600;
  padding: 2px 8px; border-radius: var(--radius-small); border: 1px solid;
}
.platform-tag--pve { background: var(--tone-pve-bg); color: var(--tone-pve-text); border-color: var(--tone-pve-border); }
.platform-tag--esxi { background: var(--tone-esxi-bg); color: var(--tone-esxi-text); border-color: var(--tone-esxi-border); }
</style>
