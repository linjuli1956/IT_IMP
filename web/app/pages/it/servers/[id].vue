<template>
  <div class="page-container">
    <PageHeader :title="detail?.name || '服务器详情'" subtitle="物理机/虚拟机详情与凭据管理">
      <template #actions>
        <el-button @click="navigateTo('/it/servers')">
          <el-icon><Back /></el-icon>
          返回列表
        </el-button>
        <el-button v-if="canEdit && detail?.isVirtual === false" type="primary" @click="handleAddVirtual">
          <el-icon><Plus /></el-icon>
          新增虚拟机
        </el-button>
        <el-button v-if="canEdit" @click="openPasswordDialog">密码管理</el-button>
      </template>
    </PageHeader>

    <el-alert v-if="!detail && !detailLoading" type="info" :closable="false" show-icon class="usage-alert">
      <template #title>服务器不存在或已删除</template>
    </el-alert>

    <div v-if="detailLoading && !detail" v-loading="detailLoading" class="detail-loading" />

    <template v-if="detail">
      <!-- 宿主/虚拟机导航 -->
      <div class="nav-bar">
        <el-button :disabled="!prevPhysicalId" @click="goPrev">上一台物理机</el-button>
        <el-button :disabled="!nextPhysicalId" @click="goNext">下一台物理机</el-button>
        <span class="nav-hint">上一台/下一台仅按物理机排序导航</span>
      </div>

      <!-- 身份与基础信息 -->
      <div class="card">
        <div class="section-title">
          <el-tag :type="detail.isVirtual ? 'warning' : 'success'" size="small">
            {{ detail.isVirtual ? '虚拟机' : '物理机' }}
          </el-tag>
          <el-tag v-if="detail.hypervisor" size="small" type="info">{{ detail.hypervisor }}</el-tag>
          <el-tag :type="getStatusTagType(detail.status)" size="small">{{ detail.status }}</el-tag>
        </div>
        <el-descriptions :column="3" border class="desc-table">
          <el-descriptions-item label="服务器类型">{{ detail.serverType }}</el-descriptions-item>
          <el-descriptions-item label="厂商">{{ detail.manufacturer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="型号">{{ detail.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="序列号">{{ detail.serialNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="内网IP">{{ detail.internalIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="外网IP">{{ detail.externalIp || '-' }}</el-descriptions-item>
          <el-descriptions-item label="操作系统">{{ detail.os || '-' }}</el-descriptions-item>
          <el-descriptions-item label="配置">{{ formatConfig(detail) }}</el-descriptions-item>
          <el-descriptions-item label="RAID">{{ detail.raidType || '-' }}</el-descriptions-item>
          <el-descriptions-item label="网卡">{{ detail.networkCards || '-' }}</el-descriptions-item>
          <el-descriptions-item label="到期日期">{{ detail.expireDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="保修到期">{{ detail.warrantyEndDate || '-' }}</el-descriptions-item>
          <!-- 管理地址：物理机显示自身；虚拟机显示宿主机管理地址（归属物理宿主机/云服务器） -->
          <el-descriptions-item :label="detail.isVirtual ? '宿主机管理地址' : '管理地址'">
            <el-link v-if="manageUrlDisplay" type="primary" :href="manageUrlDisplay" target="_blank" rel="noopener">{{ manageUrlDisplay }}</el-link>
            <span v-else class="text-secondary">-</span>
          </el-descriptions-item>
          <el-descriptions-item label="用途" :span="2">{{ detail.purpose || '-' }}</el-descriptions-item>
          <el-descriptions-item label="登录账号">{{ detail.account || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数据库账号">{{ detail.dbAccount || '-' }}</el-descriptions-item>
          <el-descriptions-item label="数据库端口">{{ detail.dbPort || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注" :span="3">{{ detail.remark || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 虚拟机：宿主信息 -->
      <div v-if="detail.isVirtual" class="card">
        <div class="section-title">所属宿主机</div>
        <div v-if="detail.hostServer" class="host-card">
          <div class="host-item">
            <span class="host-label">宿主机</span>
            <el-link type="primary" :underline="false" @click="navigateTo(`/it/servers/${detail.hostServer.id}`)">
              {{ detail.hostServer.name }}
            </el-link>
          </div>
          <div class="host-item"><span class="host-label">内网IP</span>{{ detail.hostServer.internalIp || '-' }}</div>
          <div class="host-item"><span class="host-label">平台</span>{{ detail.hostServer.hypervisor || '-' }}</div>
          <div class="host-item"><span class="host-label">系统</span>{{ detail.hostServer.os || '-' }}</div>
        </div>
        <el-empty v-else description="未关联宿主机" :image-size="60" />
      </div>

      <!-- 物理机：全部虚拟机 -->
      <div v-if="!detail.isVirtual" class="card">
        <div class="section-title">全部虚拟机（{{ detail.virtualMachines.length }} 台）</div>
        <el-table :data="detail.virtualMachines" border size="small" v-loading="loadingVm">
          <el-table-column label="名称" min-width="160">
            <template #default="{ row }">
              <el-link type="primary" :underline="false" @click="navigateTo(`/it/servers/${row.id}`)">{{ row.name }}</el-link>
            </template>
          </el-table-column>
          <el-table-column prop="internalIp" label="内网IP" width="130" />
          <el-table-column prop="os" label="操作系统" width="140" />
          <el-table-column label="分配CPU" width="90" align="center">
            <template #default="{ row }">{{ row.cpuCoresAllocated ?? '-' }} 核</template>
          </el-table-column>
          <el-table-column label="分配内存" width="100" align="center">
            <template #default="{ row }">{{ row.memoryAllocatedGB ?? '-' }} GB</template>
          </el-table-column>
          <el-table-column label="分配磁盘" width="100" align="center">
            <template #default="{ row }">{{ row.diskAllocatedGB ?? '-' }} GB</template>
          </el-table-column>
          <el-table-column prop="purpose" label="用途" min-width="140" show-overflow-tooltip />
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column v-if="canEdit" label="操作" width="90" align="center">
            <template #default="{ row }">
              <el-button size="small" type="danger" @click="handleDeleteVm(row as ServerVirtualMachine)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="detail.virtualMachines.length === 0" description="暂无虚拟机，点击右上角「新增虚拟机」" :image-size="60" />
      </div>
    </template>

    <!-- 密码管理弹窗（查看/更新双模式，与列表页一致） -->
    <el-dialog v-model="passwordDialogVisible" title="密码管理" width="480px" destroy-on-close>
      <el-form :model="passwordForm" label-width="100px">
        <el-form-item label="登录密码">
          <el-input v-model="passwordForm.password" type="password" show-password :placeholder="passwordMode === 'view' ? '查看模式' : '留空保持不变'" />
        </el-form-item>
        <el-form-item label="数据库密码">
          <el-input v-model="passwordForm.dbPassword" type="password" show-password :placeholder="passwordMode === 'view' ? '查看模式' : '留空保持不变'" />
        </el-form-item>
        <el-alert type="info" :closable="false" show-icon>
          <template #title>{{ passwordMode === 'view' ? '查看模式：显示当前保存的密码' : '更新模式：留空字段保持不变，非空则覆盖' }}</template>
        </el-alert>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">关闭</el-button>
        <el-button v-if="passwordMode === 'view'" @click="switchPasswordMode">切换为更新</el-button>
        <el-button v-else type="primary" :loading="savingPassword" @click="handleSavePassword">保存密码</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Back, Plus } from '@element-plus/icons-vue'
import { useServerData, getStatusTagType } from '~/composables/useServerData'
import { getApiErrorMessage } from '~/composables/useApi'
import type { ServerDetail, ServerVirtualMachine } from '~/types/server'

const route = useRoute()
const serverId = computed(() => Number(route.params.id))

const {
  fetchServerDetail, fetchServerPassword, fetchPhysicalHosts, hostOptions, deleteServer, updateServerPassword,
} = useServerData()

const detail = ref<ServerDetail | null>(null)
const detailLoading = ref(false)
const loadingVm = ref(false)
const canEdit = ref(false)
/** 物理机 id 顺序（用于上一台/下一台导航） */
const physicalIds = ref<number[]>([])
/** 加载序号：防止动态路由切换时旧请求覆盖新数据 */
let loadSeq = 0

onMounted(async () => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  await loadAll()
  if (canEdit.value) fetchPhysicalHosts()
})

// 动态路由：从 A 详情跳转宿主/虚拟机 B 时组件复用，watch 重新加载（清理旧数据 + 防旧请求覆盖）
watch(() => route.params.id, () => { loadAll() })

async function loadAll() {
  const seq = ++loadSeq
  detail.value = null
  physicalIds.value = []
  detailLoading.value = true
  try {
    await Promise.all([loadDetail(seq), loadPhysicalNav(seq)])
  } finally {
    if (seq === loadSeq) detailLoading.value = false
  }
}

async function loadDetail(seq: number) {
  const data = await fetchServerDetail(serverId.value)
  if (seq !== loadSeq) return // 已有更新的路由加载
  detail.value = data
}

/** 拉取物理机 id 列表（专用 hosts 接口，全量；供上一台/下一台） */
async function loadPhysicalNav(seq: number) {
  const { get } = useApi()
  try {
    const hosts = await get<{ id: number }[]>('/api/servers/hosts')
    if (seq !== loadSeq) return
    physicalIds.value = hosts.map(h => h.id)
  } catch {
    if (seq === loadSeq) physicalIds.value = []
  }
}

const physicalIndex = computed(() => physicalIds.value.indexOf(serverId.value))
const prevPhysicalId = computed(() => physicalIndex.value > 0 ? physicalIds.value[physicalIndex.value - 1] : 0)
const nextPhysicalId = computed(() => physicalIndex.value >= 0 && physicalIndex.value < physicalIds.value.length - 1 ? physicalIds.value[physicalIndex.value + 1] : 0)

function goPrev() { if (prevPhysicalId.value) navigateTo(`/it/servers/${prevPhysicalId.value}`) }
function goNext() { if (nextPhysicalId.value) navigateTo(`/it/servers/${nextPhysicalId.value}`) }

/** 管理地址（物理机=自身；虚拟机=宿主机控制台地址；归属物理宿主机/云服务器） */
const manageUrlDisplay = computed(() => {
  if (!detail.value) return undefined
  return detail.value.isVirtual ? (detail.value.hostServer?.manageUrl ?? undefined) : (detail.value.manageUrl ?? undefined)
})

function formatConfig(row: ServerDetail): string {
  const parts: string[] = []
  if (row.cpuCores) parts.push(row.cpuCores)
  if (row.memorySize) parts.push(row.memorySize)
  const disks = [row.systemDiskSize, row.dataDiskSize].filter(Boolean)
  if (disks.length) parts.push(disks.join('+'))
  if (row.diskType) parts.push(row.diskType)
  return parts.join('/') || '-'
}

/** 新增虚拟机：跳列表页并自动带宿主（复用列表页完整表单） */
function handleAddVirtual() {
  navigateTo(`/it/servers?addVirtual=${serverId.value}`)
}

/** 删除虚拟机（直接删除子项；删除当前服务器由列表页处理） */
async function handleDeleteVm(row: ServerVirtualMachine) {
  try {
    await ElMessageBox.confirm(`确定要删除虚拟机"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    loadingVm.value = true
    await deleteServer(row.id)
    ElMessage.success('删除成功')
    await loadAll() // 刷新详情 + 物理机导航（含 seq 防旧请求覆盖）
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  } finally {
    loadingVm.value = false
  }
}

// —— 密码管理（独立接口，查看/更新双模式）——
const passwordDialogVisible = ref(false)
const passwordMode = ref<'view' | 'update'>('view')
const savingPassword = ref(false)
const passwordForm = reactive({ password: '', dbPassword: '' })

async function openPasswordDialog() {
  if (!detail.value) return
  passwordMode.value = 'view'
  passwordForm.password = ''
  passwordForm.dbPassword = ''
  passwordDialogVisible.value = true
  try {
    const data = await fetchServerPassword(detail.value.id)
    passwordForm.password = data.password
    passwordForm.dbPassword = data.dbPassword
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

function switchPasswordMode() {
  passwordMode.value = 'update'
  passwordForm.password = ''
  passwordForm.dbPassword = ''
}

async function handleSavePassword() {
  if (!detail.value) return
  savingPassword.value = true
  try {
    await updateServerPassword(detail.value.id, {
      ...(passwordForm.password ? { password: passwordForm.password } : {}),
      ...(passwordForm.dbPassword ? { dbPassword: passwordForm.dbPassword } : {}),
    })
    ElMessage.success('密码已更新')
    passwordDialogVisible.value = false
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    savingPassword.value = false
  }
}
</script>

<style scoped>
.nav-bar { display: flex; align-items: center; gap: 12px; margin-bottom: var(--spacing-card); }
.nav-hint { font-size: var(--font-size-mini); color: var(--text-secondary); }
.section-title { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-subtitle); font-weight: 600; margin-bottom: var(--spacing-card); }
.desc-table { margin-bottom: 4px; }
.host-card { display: flex; flex-wrap: wrap; gap: 24px; }
.host-item { display: flex; flex-direction: column; gap: 4px; }
.host-label { font-size: var(--font-size-mini); color: var(--text-secondary); }
</style>
