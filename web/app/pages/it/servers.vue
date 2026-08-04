<template>
  <div class="page-container">
    <PageHeader title="服务器管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增服务器
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理本地服务器和各云平台服务器（阿里云/腾讯云/华为云等）的内外网IP、硬件配置、操作系统、登录凭证和数据库凭证</p>
        <p>2. 服务器类型支持下拉选择或自定义输入，每种类型有独立配色标签</p>
        <p>3. 敏感信息（登录密码、数据库账号、数据库密码）默认脱敏显示，点击眼睛图标可切换显示/隐藏</p>
        <p>4. 云服务器到期日期≤30天标红、≤90天标橙；支持全字段搜索，类型和状态列可筛选</p>
      </div>
    </el-alert>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Monitor" :color="vars.primary" :bg="vars.primaryLight" :value="serverList.length" label="服务器总数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="HomeFilled" :color="vars.info" :bg="vars.infoLight" :value="localCount" label="本地服务器" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Cloudy" :color="vars.warning" :bg="vars.warningLight" :value="cloudCount" label="云服务器" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="vars.danger" :bg="vars.dangerLight" :value="expiringSoonCount" label="即将到期(30天)" />
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <div class="card filter-bar">
      <el-input v-model="filterKeyword" placeholder="搜索名称/云账号/IP/操作系统/用途/账号/备注" clearable style="width: 400px" />
    </div>

    <!-- 表格 -->
    <div class="card">
      <CrudTable
        :columns="columns"
        :data="filteredServers"
        :loading="loading"
        :stripe="false"
        :row-class-name="getServerRowClass"
        :show-batch-copy="true"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-copy="handleBatchCopy"
      >
        <template #serverType="{ row }">
          <el-tag v-bind="getServerTypeTagAttrs(row.serverType)" size="small">
            {{ row.serverType }}
          </el-tag>
        </template>
        <template #config="{ row }">
          <span class="config-text">{{ formatConfig(row) }}</span>
        </template>
        <template #expireDate="{ row }">
          <el-tag v-if="getExpireDays(row.expireDate) !== null" :type="getExpireTagType(row.expireDate)" size="small">
            {{ getExpireLabel(row.expireDate) }}
          </el-tag>
          <span v-else class="text-secondary">-</span>
        </template>
        <template #password="{ row }">
          <SensitiveValue :value="row.password" />
        </template>
        <template #dbAccount="{ row }">
          <SensitiveValue :value="row.dbAccount" />
        </template>
        <template #dbPassword="{ row }">
          <SensitiveValue :value="row.dbPassword" />
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </CrudTable>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="780px" destroy-on-close>
      <el-form :model="formData" label-width="100px" :rules="rules" ref="formRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" prop="name">
              <el-input v-model="formData.name" placeholder="如：财务数据库服务器" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="服务器类型" prop="serverType">
              <el-select v-model="formData.serverType" placeholder="选择或输入类型" filterable allow-create default-first-option style="width: 100%" @change="onServerTypeChange">
                <el-option v-for="t in serverTypeOptions" :key="t.value" :label="t.label" :value="t.value" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="内网IP">
              <el-input v-model="formData.internalIp" placeholder="如：192.168.0.100（云服务器可留空）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="外网IP">
              <el-input v-model="formData.externalIp" placeholder="如：SERVER_IP（本地可留空）" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="端口" prop="port">
              <el-input v-model="formData.port" placeholder="如：22（SSH默认端口）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="操作系统">
              <el-input v-model="formData.os" placeholder="如：CentOS 7.9 / Ubuntu 22.04" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="CPU型号">
              <el-input v-model="formData.cpuModel" placeholder="如：Intel Xeon E5-2620 v4" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="CPU核数">
              <el-input v-model="formData.cpuCores" placeholder="如：8核" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="内存大小">
              <el-input v-model="formData.memorySize" placeholder="如：32GB" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="硬盘类型">
              <el-select v-model="formData.diskType" placeholder="选择硬盘类型" clearable style="width: 100%">
                <el-option v-for="t in diskTypeOptions" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="系统盘">
              <el-input v-model="formData.systemDiskSize" placeholder="如：100GB" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据盘">
              <el-input v-model="formData.dataDiskSize" placeholder="如：1TB（无数据盘可留空）" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="云账号">
              <el-input v-model="formData.cloudAccount" placeholder="如：demo@example.invalid（本地可留空）" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期">
              <el-date-picker v-model="formData.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="云服务器续费日期" clearable style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="用途" prop="purpose">
              <el-input v-model="formData.purpose" placeholder="如：MySQL主数据库" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-radio-group v-model="formData.status">
                <el-radio v-for="s in serverStatusOptions" :key="s" :value="s">{{ s }}</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="登录账号" prop="account">
              <el-input v-model="formData.account" placeholder="如：root" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="登录密码" prop="password">
              <el-input v-model="formData.password" type="password" show-password placeholder="请输入登录密码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="数据库账号">
              <el-input v-model="formData.dbAccount" type="password" show-password placeholder="无数据库可留空" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="数据库密码">
              <el-input v-model="formData.dbPassword" type="password" show-password placeholder="无数据库可留空" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="数据库端口">
              <el-input v-model="formData.dbPort" placeholder="如：3306（无数据库可留空）" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注">
          <el-input v-model="formData.remark" type="textarea" :rows="2" placeholder="请输入备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Monitor, HomeFilled, Cloudy, WarningFilled } from '@element-plus/icons-vue'
import {
  useServerData, serverTypeOptions, getServerTypeTagAttrs, assignCustomTypeColor,
  getExpireDays, diskTypeOptions,
  type ServerItem,
} from '~/composables/useServerData'
import { getApiErrorMessage } from '~/composables/useApi'

const { serverList, loading, serverStatusOptions, expiringSoonCount, fetchServers, addServer, updateServer, deleteServer } = useServerData()

onMounted(() => {
  fetchServers()
})

// —— CSS 变量颜色引用 ——
const vars = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)',
  successLight: 'var(--color-success-light)',
  info: 'var(--color-info)',
  infoLight: 'var(--color-info-light)',
  warning: 'var(--color-warning)',
  warningLight: 'var(--color-warning-light)',
  danger: 'var(--color-danger)',
  dangerLight: 'var(--color-danger-light)',
}

// —— 概览统计 ——
const localCount = computed(() => serverList.value.filter(s => s.serverType === '本地').length)
const cloudCount = computed(() => serverList.value.filter(s => s.serverType !== '本地').length)

// —— 辅助函数 ——
function formatConfig(row: ServerItem): string {
  const parts: string[] = []
  if (row.cpuCores) parts.push(row.cpuCores)
  if (row.memorySize) parts.push(row.memorySize)
  const disks: string[] = []
  if (row.systemDiskSize) disks.push(row.systemDiskSize)
  if (row.dataDiskSize) disks.push(row.dataDiskSize)
  if (disks.length) parts.push(disks.join('+'))
  if (row.diskType) parts.push(row.diskType)
  return parts.join('/') || '-'
}

function getExpireTagType(date: string): 'info' | 'danger' | 'warning' {
  const days = getExpireDays(date)
  if (days === null) return 'info'
  if (days <= 0) return 'danger'
  if (days <= 30) return 'danger'
  if (days <= 90) return 'warning'
  return 'info'
}

function getExpireLabel(date: string): string {
  const days = getExpireDays(date)
  if (days === null) return '-'
  if (days <= 0) return `已过期${Math.abs(days)}天`
  return `${date} (${days}天)`
}

// —— 列头筛选（类型从数据动态生成）——
const serverTypeFilters = computed(() =>
  [...new Set(serverList.value.map(s => s.serverType))]
    .map(v => ({ text: v, value: v }))
)
const osFilters = computed(() =>
  [...new Set(serverList.value.map(s => s.os).filter(Boolean))]
    .map(v => ({ text: v, value: v }))
)
const purposeFilters = computed(() =>
  [...new Set(serverList.value.map(s => s.purpose).filter(Boolean))]
    .map(v => ({ text: v, value: v }))
)
const statusFilters = [
  { text: '正常', value: '正常' },
  { text: '停用', value: '停用' },
]

const columns = computed(() => [
  { prop: 'name', label: '名称', width: 160 },
  { prop: 'serverType', label: '类型', width: 100, align: 'center' as const, slot: 'serverType', filters: serverTypeFilters.value, filterMethod: (v: any, r: any) => r.serverType === v },
  { prop: 'internalIp', label: '内网IP', width: 130 },
  { prop: 'externalIp', label: '外网IP', width: 130 },
  { prop: 'port', label: '端口', width: 80, align: 'center' as const },
  { prop: 'config', label: '配置', width: 180, slot: 'config' },
  { prop: 'os', label: '操作系统', width: 130, filters: osFilters.value, filterMethod: (v: any, r: any) => r.os === v },
  { prop: 'purpose', label: '用途', minWidth: 160, filters: purposeFilters.value, filterMethod: (v: any, r: any) => r.purpose === v },
  { prop: 'expireDate', label: '到期日期', width: 150, align: 'center' as const, slot: 'expireDate' },
  { prop: 'account', label: '登录账号', width: 110 },
  { prop: 'password', label: '登录密码', width: 160, slot: 'password' },
  { prop: 'dbAccount', label: '数据库账号', width: 160, slot: 'dbAccount' },
  { prop: 'dbPassword', label: '数据库密码', width: 160, slot: 'dbPassword' },
  { prop: 'dbPort', label: '数据库端口', width: 100, align: 'center' as const },
  { prop: 'status', label: '状态', width: 80, align: 'center' as const, slot: 'status', filters: statusFilters, filterMethod: (v: any, r: any) => r.status === v },
  { prop: 'remark', label: '备注', minWidth: 140 },
])

// —— 搜索 ——
const filterKeyword = ref('')

const filteredServers = computed(() => {
  if (!filterKeyword.value) return serverList.value
  const kw = filterKeyword.value.toLowerCase()
  return serverList.value.filter(s => {
    const haystack = [s.name, s.cloudAccount, s.internalIp, s.externalIp, s.os, s.port, s.purpose, s.account, s.dbPort, s.remark]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(kw)
  })
})

// —— 类型变更时分配自定义颜色 ——
function onServerTypeChange(val: string) {
  assignCustomTypeColor(val)
}

// —— 弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive<ServerItem>({
  id: 0,
  name: '',
  serverType: '本地',
  cloudAccount: '',
  internalIp: '',
  externalIp: '',
  port: '22',
  cpuModel: '',
  cpuCores: '',
  memorySize: '',
  systemDiskSize: '',
  dataDiskSize: '',
  diskType: '',
  os: '',
  expireDate: '',
  purpose: '',
  account: '',
  password: '',
  dbAccount: '',
  dbPassword: '',
  dbPort: '',
  remark: '',
  status: '正常',
})

const rules = {
  name: [{ required: true, message: '请输入服务器名称', trigger: 'blur' }],
  serverType: [{ required: true, message: '请选择服务器类型', trigger: 'change' }],
  purpose: [{ required: true, message: '请输入用途', trigger: 'blur' }],
  account: [{ required: true, message: '请输入登录账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入登录密码', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function handleAdd() {
  dialogTitle.value = '新增服务器'
  Object.assign(formData, {
    id: 0, name: '', serverType: '本地', cloudAccount: '',
    internalIp: '', externalIp: '', port: '22',
    cpuModel: '', cpuCores: '', memorySize: '', systemDiskSize: '', dataDiskSize: '', diskType: '',
    os: '', expireDate: '',
    purpose: '', account: '', password: '', dbAccount: '', dbPassword: '', dbPort: '',
    remark: '', status: '正常',
  })
  dialogVisible.value = true
}

function handleEdit(row: any) {
  const s = row as ServerItem
  dialogTitle.value = '编辑服务器'
  Object.assign(formData, s)
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        const { id: _omitId, ...serverData } = formData
        await addServer(serverData)
        ElMessage.success('新增成功')
      } else {
        await updateServer(formData.id, { ...formData })
        ElMessage.success('编辑成功')
      }
      dialogVisible.value = false
    } catch (error) {
      ElMessage.error(getApiErrorMessage(error))
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: any) {
  const s = row as ServerItem
  try {
    await ElMessageBox.confirm(`确定要删除"${s.name}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteServer(s.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

async function handleBatchDelete(rows: any[]) {
  const ids = (rows as ServerItem[]).map(r => r.id)
  try {
    for (const id of ids) {
      await deleteServer(id)
    }
    ElMessage.success(`已删除 ${ids.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 服务器类型行底色 ——
const serverTypeBgMap: Record<string, string> = {
  '本地': 'server-type-local',
  '阿里云': 'server-type-aliyun',
  '腾讯云': 'server-type-tencent',
  '华为云': 'server-type-huawei',
}
function getServerRowClass({ row }: { row: any }) {
  return serverTypeBgMap[row.serverType] || 'server-type-other'
}

// —— 批量复制（Tab分隔，可粘贴Excel，排除敏感字段）——
function handleBatchCopy(rows: any[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['名称', '类型', '内网IP', '外网IP', '端口', '配置', '操作系统', '用途', '到期日期', '登录账号', '状态', '备注']
  const lines = (rows as ServerItem[]).map(row => [
    row.name, row.serverType, row.internalIp, row.externalIp, row.port,
    formatConfig(row), row.os, row.purpose, row.expireDate,
    row.account, row.status, row.remark,
  ].join('\t'))
  const text = [headers.join('\t'), ...lines].join('\n')
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(`已复制 ${rows.length} 行数据（可粘贴到Excel）`)
  }).catch(() => {
    ElMessage.error('复制失败，请重试')
  })
}
</script>

<style scoped>
.config-text {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
  white-space: nowrap;
}

/* 服务器类型行底色 */
:deep(.server-type-local > td) { background: var(--server-type-local-bg) !important; }
:deep(.server-type-aliyun > td) { background: var(--server-type-aliyun-bg) !important; }
:deep(.server-type-tencent > td) { background: var(--server-type-tencent-bg) !important; }
:deep(.server-type-huawei > td) { background: var(--server-type-huawei-bg) !important; }
:deep(.server-type-other > td) { background: var(--server-type-other-bg) !important; }
:deep(.server-type-local:hover > td) { background: var(--server-type-local-hover) !important; }
:deep(.server-type-aliyun:hover > td) { background: var(--server-type-aliyun-hover) !important; }
:deep(.server-type-tencent:hover > td) { background: var(--server-type-tencent-hover) !important; }
:deep(.server-type-huawei:hover > td) { background: var(--server-type-huawei-hover) !important; }
:deep(.server-type-other:hover > td) { background: var(--server-type-other-hover) !important; }
</style>
