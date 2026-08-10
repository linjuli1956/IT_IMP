<template>
  <div class="mock-vm-card" :class="[serverToneClass(server), { 'is-selected': isSelected }]" @click="$emit('click', server)">
    <!-- 头部 -->
    <div class="card-header">
      <RecordPreviewTooltip :rows="previewRows" :title="server.name" placement="bottom" :max-rows="7" :max-width="360" variant="light">
        <template #reference>
          <span class="card-name" tabindex="0" :aria-label="server.name">{{ server.name }}</span>
        </template>
      </RecordPreviewTooltip>
      <span v-if="tone.platform" class="platform-tag" :class="tone.platform === 'PVE' ? 'platform-tag--pve' : 'platform-tag--esxi'">{{ tone.platform }}</span>
      <el-tag size="small" type="warning" effect="light">虚拟机</el-tag>
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

    <!-- 分配资源 -->
    <div class="card-specs">
      <div class="spec-item"><span class="spec-label spec-label--cpu">CPU</span><span class="spec-value">{{ server.cpuCoresAllocated != null ? `${server.cpuCoresAllocated}核` : '—' }}</span></div>
      <div class="spec-item"><span class="spec-label spec-label--memory">内存</span><span class="spec-value">{{ server.memoryAllocatedGB != null ? `${server.memoryAllocatedGB}GB` : '—' }}</span></div>
      <div class="spec-item"><span class="spec-label spec-label--disk">磁盘</span><span class="spec-value">{{ server.diskAllocatedGB != null ? `${server.diskAllocatedGB}GB` : '—' }}</span></div>
      <div class="spec-item"><span class="spec-label">系统</span><span class="spec-value">{{ server.os || '—' }}</span></div>
    </div>

    <!-- 归属：点击宿主机名称打开宿主机 Drawer（不重新打开当前 VM） -->
    <div class="card-host">
      <span class="host-label">宿主机</span>
      <span v-if="server.hostServerName" class="host-name" @click.stop="$emit('click-host', server)">{{ server.hostServerName }}</span>
      <span v-else class="host-name">—</span>
    </div>

    <!-- 底部 -->
    <div class="card-footer">
      <span class="vm-count">{{ server.hostServerName || '未分配' }}</span>
      <a v-if="hostManageUrl" :href="hostManageUrl" target="_blank" rel="noopener" class="go-manage" @click.stop>
        进入宿主机管理 <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Monitor, Connection, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import type { ServerListItem } from '~/types/server'
import { serverVisualTone, serverToneClass } from '~/utils/server-visual-tone'
import { buildVmPreviewRows } from '~/utils/server-preview'

const props = defineProps<{
  server: ServerListItem
  canEdit: boolean
  isSelected?: boolean
}>()

defineEmits<{
  click: [row: ServerListItem]
  edit: [row: ServerListItem]
  delete: [row: ServerListItem]
  'click-host': [row: ServerListItem]
}>()

const tone = computed(() => serverVisualTone(props.server))
const previewRows = computed(() => buildVmPreviewRows(props.server, null))

const statusTagType = computed(() => {
  switch (props.server.status) {
    case '正常': return 'success'
    case '停用': return 'info'
    case '报废': return 'danger'
    default: return 'info'
  }
})

const hostManageUrl = computed(() => props.server.hostManageUrl)
</script>

<style scoped>
.mock-vm-card {
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

/* —— 平台 Tone 底色（VM 继承宿主平台色）—— */
.mock-vm-card.server-tone-pve {
  background: var(--tone-pve-bg);
  border-color: var(--tone-pve-border);
}
.mock-vm-card.server-tone-esxi {
  background: var(--tone-esxi-bg);
  border-color: var(--tone-esxi-border);
}
.mock-vm-card.server-tone-other {
  background: var(--tone-other-bg);
  border-color: var(--tone-other-border);
}

.mock-vm-card:hover { box-shadow: var(--shadow-card); }
.mock-vm-card.is-selected { border-color: var(--color-primary); box-shadow: 0 0 0 2px var(--color-primary-border); }

.card-header { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.card-name { font-size: var(--font-size-subtitle); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 180px; cursor: pointer; }
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

.card-host { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-small); }
.host-label { color: var(--text-secondary); flex-shrink: 0; }
.host-name { color: var(--color-primary); cursor: pointer; }
.host-name:hover { text-decoration: underline; }

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
