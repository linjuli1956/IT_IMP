<template>
  <div class="page-container">
    <PageHeader
      title="域名管理"
      subtitle="域名与 SSL 证书台账"
      :description="`管理阿里云域名及其主账号凭证。记录 SSL 证书类型（DV/OV/EV）、颁发机构、到期日期。敏感信息默认脱敏显示。`"
    >
      <template #actions>
        <el-radio-group v-model="viewMode" size="small" class="view-switcher">
          <el-radio-button value="card">卡片总览</el-radio-button>
          <el-radio-button value="list">列表管理</el-radio-button>
        </el-radio-group>
        <el-button v-if="canEdit" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增域名
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Document" :color="vars.primary" :bg="vars.primaryLight" :value="domainList.length" label="域名总数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleCheck" :color="vars.success" :bg="vars.successLight" :value="activeCount" label="正常" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="WarningFilled" :color="vars.warning" :bg="vars.warningLight" :value="expiringCount" label="即将到期(30天)" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleClose" :color="vars.danger" :bg="vars.dangerLight" :value="expiredCount" label="已过期" />
      </el-col>
    </el-row>

    <!-- 搜索+筛选栏（两种视图共享） -->
    <div class="card filter-bar">
      <el-input v-model="filterKeyword" placeholder="搜索域名/账号/颁发机构/备注" clearable style="width: 320px" :prefix-icon="Search" />
      <el-select v-model="filterCertType" placeholder="证书类型" clearable style="width: 130px">
        <el-option v-for="c in certTypeOptions" :key="c.value" :label="c.label" :value="c.value" />
      </el-select>
      <el-select v-model="filterIssuer" placeholder="颁发机构" clearable style="width: 150px">
        <el-option v-for="i in issuerOptions" :key="i" :label="i" :value="i" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 110px">
        <el-option v-for="s in domainStatusOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <span class="filter-count">{{ filteredDomains.length }} 个结果</span>
    </div>

    <!-- 卡片视图 -->
    <div v-if="viewMode === 'card'" class="card" v-loading="loading">
      <div class="card-grid" v-if="filteredDomains.length > 0">
        <ServiceAssetCard
          v-for="d in filteredDomains" :key="d.id"
          :title="d.domain" :subtitle="d.certIssuer || '服务商未填'"
          :tags="domainTags(d)" :fields="domainFields(d)" :can-edit="canEdit"
          @click="openDrawer(d)" @edit="handleEdit(d)" @delete="handleDelete(d)"
        />
      </div>
      <EmptyState v-else description="暂无域名数据" />
    </div>

    <!-- 列表视图 -->
    <div v-else class="card">
      <CrudTable
        v-if="filteredDomains.length > 0 || loading"
        :columns="columns"
        :data="filteredDomains"
        :loading="loading"
        :show-batch-copy="true"
        :show-batch-delete="canEdit"
        :show-actions="canEdit"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-copy="handleBatchCopy"
      >
        <template #domain="{ row }">
          <RecordPreviewTooltip :title="row.domain" :rows="buildDomainPreviewRows(row)">
            <template #reference>
              <span class="domain-name" tabindex="0" :aria-label="`预览 ${row.domain}`">{{ row.domain }}</span>
            </template>
          </RecordPreviewTooltip>
        </template>
        <template #mainAccount="{ row }">
          <SensitiveValue :value="row.mainAccount" />
        </template>
        <template #mainPassword="{ row }">
          <SensitiveValue :value="row.mainPassword" />
        </template>
        <template #certType="{ row }">
          <el-tag :type="(certTypeTagMap[row.certType] as any) || 'info'" size="small">{{ row.certType || '—' }}</el-tag>
        </template>
        <template #certExpireDate="{ row }">
          <div class="expire-cell">
            <span>{{ row.certExpireDate || '—' }}</span>
            <el-tag v-if="row.certExpireDate" size="small" :type="expireTagType(row.certExpireDate)">
              {{ expireLabel(row.certExpireDate) }}
            </el-tag>
          </div>
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </CrudTable>
      <EmptyState v-else description="暂无域名数据" />
    </div>

    <!-- 详情抽屉（敏感字段按需显示） -->
    <AssetDetailDrawer v-model="drawerVisible" :title="currentRow?.domain || '详情'" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ currentRow?.certIssuer || '服务商未填' }}</span>
        <el-tag :type="getAssetStatusTagType(currentRow?.status || '')" size="small">{{ currentRow?.status }}</el-tag>
        <el-tag v-if="currentRow?.certExpireDate" size="small" :type="expireTagType(currentRow.certExpireDate)">
          {{ expireLabel(currentRow.certExpireDate) }}
        </el-tag>
      </template>
      <el-descriptions v-if="currentRow" :column="2" border size="small">
        <el-descriptions-item label="域名">{{ currentRow.domain }}</el-descriptions-item>
        <el-descriptions-item label="服务商">{{ currentRow.certIssuer || '—' }}</el-descriptions-item>
        <el-descriptions-item label="证书类型">{{ currentRow.certType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ currentRow.status }}</el-descriptions-item>
        <el-descriptions-item label="更换日期">{{ currentRow.certRenewDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="到期日期">{{ currentRow.certExpireDate || '—' }}</el-descriptions-item>
        <el-descriptions-item label="主账号"><SensitiveValue :value="currentRow.mainAccount" /></el-descriptions-item>
        <el-descriptions-item label="主账号密码"><SensitiveValue :value="currentRow.mainPassword" /></el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '—' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button v-if="canEdit" type="primary" @click="handleEditFromDrawer">编辑</el-button>
        <el-button v-if="canEdit" type="danger" @click="handleDeleteFromDrawer">删除</el-button>
      </template>
    </AssetDetailDrawer>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="560px" destroy-on-close>
      <el-form :model="formData" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="域名" prop="domain">
          <el-input v-model="formData.domain" placeholder="如：example.invalid" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="主账号" prop="mainAccount">
              <el-input v-model="formData.mainAccount" type="password" show-password placeholder="阿里云主账号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="主账号密码" prop="mainPassword">
              <el-input v-model="formData.mainPassword" type="password" show-password placeholder="请输入主账号密码" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="证书类型" prop="certType">
              <el-select v-model="formData.certType" placeholder="选择证书类型" style="width: 100%">
                <el-option v-for="c in certTypeOptions" :key="c.value" :label="c.label" :value="c.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="颁发机构">
              <el-input v-model="formData.certIssuer" placeholder="如：Let's Encrypt、阿里云SSL" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="更换日期">
              <el-date-picker v-model="formData.certRenewDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期">
              <el-date-picker v-model="formData.certExpireDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio v-for="s in domainStatusOptions" :key="s" :value="s">{{ s }}</el-radio>
          </el-radio-group>
        </el-form-item>
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
import { Plus, Document, CircleCheck, WarningFilled, CircleClose, Search } from '@element-plus/icons-vue'
import { useDomainData, certTypeOptions, certTypeTagMap, type DomainItem } from '~/composables/useDomainData'
import { buildDomainPreviewRows } from '~/utils/preview-utils'
import { getExpireInfo, getAssetStatusTagType } from '~/utils/asset-utils'
import { getApiErrorMessage } from '~/composables/useApi'
import type { ServiceTag, ServiceField } from '~/components/common/ServiceAssetCard.vue'

const { domainList, loading, domainStatusOptions, fetchDomains, addDomain, updateDomain, deleteDomain } = useDomainData()

// —— 视图模式切换：默认卡片总览 ——
const viewMode = ref<'card' | 'list'>('card')

const canEdit = ref(false)

onMounted(() => {
  fetchDomains()
  // 权限：从 localStorage 获取角色，管理员/操作员可编辑
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
})

// —— CSS 变量颜色引用 ——
const vars = {
  primary: 'var(--color-primary)', primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)', successLight: 'var(--color-success-light)',
  warning: 'var(--color-warning)', warningLight: 'var(--color-warning-light)',
  danger: 'var(--color-danger)', dangerLight: 'var(--color-danger-light)',
}

// —— 概览统计 ——
const activeCount = computed(() => domainList.value.filter(d => d.status === '正常').length)
const expiringCount = computed(() => domainList.value.filter(d => {
  const e = getExpireInfo(d.certExpireDate)
  return e.days !== null && e.days > 0 && e.days <= 30
}).length)
const expiredCount = computed(() => domainList.value.filter(d => {
  const e = getExpireInfo(d.certExpireDate)
  return e.days !== null && e.days < 0
}).length)

// —— 搜索 + 筛选（两种视图共享）——
// 搜索含主账号，但主账号不进入卡片字段或 Hover
const filterKeyword = ref('')
const filterCertType = ref('')
const filterIssuer = ref('')
const filterStatus = ref('')

// 颁发机构选项：由 domainList 去重生成
const issuerOptions = computed(() => {
  const set = new Set<string>()
  domainList.value.forEach(d => { if (d.certIssuer) set.add(d.certIssuer) })
  return Array.from(set).sort()
})

const filteredDomains = computed(() => {
  const kw = filterKeyword.value.toLowerCase()
  return domainList.value.filter(d => {
    // 搜索 haystack 包含主账号（可被搜索到），但不进入卡片字段
    const haystack = [d.domain, d.mainAccount, d.certIssuer, d.remark].filter(Boolean).join(' ').toLowerCase()
    const hitKw = !kw || haystack.includes(kw)
    const hitType = !filterCertType.value || d.certType === filterCertType.value
    const hitIssuer = !filterIssuer.value || d.certIssuer === filterIssuer.value
    const hitStatus = !filterStatus.value || d.status === filterStatus.value
    return hitKw && hitType && hitIssuer && hitStatus
  })
})

// —— 卡片 Tag / Field 构造 ——
function certTagType(t: string | null): ServiceTag['type'] {
  if (t === 'EV') return 'success'
  if (t === 'OV') return 'warning'
  if (t === 'DV') return 'info'
  return 'info'
}
function expireTagType(date: string): ServiceTag['type'] {
  const t = getExpireInfo(date).tagType
  if (t === 'danger') return 'danger'
  if (t === 'warning') return 'warning'
  return 'success'
}
function expireLabel(date: string): string {
  const e = getExpireInfo(date)
  if (e.days === null) return '—'
  if (e.days < 0) return `已过期${Math.abs(e.days)}天`
  if (e.days === 0) return '今天到期'
  return `${e.days}天后到期`
}
function domainTags(d: DomainItem): ServiceTag[] {
  return [
    { label: d.certType || '无证书', type: certTagType(d.certType) },
    { label: expireLabel(d.certExpireDate), type: expireTagType(d.certExpireDate) },
    { label: d.status, type: d.status === '正常' ? 'success' : 'danger' },
  ]
}
function domainFields(d: DomainItem): ServiceField[] {
  return [
    { label: '管理平台', value: '阿里云' },
    { label: '备注', value: d.remark || '—' },
  ]
}

// —— 列表视图列配置（不含 row-class-name 整行底色）——
const columns = [
  { prop: 'domain', label: '域名', minWidth: 200, slot: 'domain' },
  { prop: 'mainAccount', label: '主账号', width: 180, slot: 'mainAccount' },
  { prop: 'mainPassword', label: '主账号密码', width: 180, slot: 'mainPassword' },
  { prop: 'certType', label: '证书类型', width: 90, align: 'center' as const, slot: 'certType' },
  { prop: 'certIssuer', label: '颁发机构', width: 140 },
  { prop: 'certRenewDate', label: '更换日期', width: 120 },
  { prop: 'certExpireDate', label: '到期日期', minWidth: 200, slot: 'certExpireDate' },
  { prop: 'status', label: '状态', width: 90, align: 'center' as const, slot: 'status' },
  { prop: 'remark', label: '备注', minWidth: 150 },
]

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const currentRow = ref<DomainItem | null>(null)
function openDrawer(row: DomainItem) {
  currentRow.value = row
  drawerVisible.value = true
}
function handleEditFromDrawer() {
  if (currentRow.value) {
    drawerVisible.value = false
    handleEdit(currentRow.value)
  }
}
function handleDeleteFromDrawer() {
  if (currentRow.value) {
    drawerVisible.value = false
    handleDelete(currentRow.value)
  }
}

// —— 新增/编辑弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive<DomainItem>({
  id: 0, domain: '', mainAccount: '', mainPassword: '',
  certType: '', certIssuer: '', certRenewDate: '', certExpireDate: '',
  remark: '', status: '正常',
})

const rules = {
  domain: [{ required: true, message: '请输入域名', trigger: 'blur' }],
  mainAccount: [{ required: true, message: '请输入主账号', trigger: 'blur' }],
  mainPassword: [{ required: true, message: '请输入主账号密码', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function handleAdd() {
  dialogTitle.value = '新增域名'
  Object.assign(formData, {
    id: 0, domain: '', mainAccount: '', mainPassword: '',
    certType: '', certIssuer: '', certRenewDate: '', certExpireDate: '',
    remark: '', status: '正常',
  })
  dialogVisible.value = true
}

function handleEdit(row: DomainItem) {
  dialogTitle.value = '编辑域名'
  Object.assign(formData, row)
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        await addDomain({
          domain: formData.domain, mainAccount: formData.mainAccount, mainPassword: formData.mainPassword,
          certType: formData.certType, certIssuer: formData.certIssuer,
          certRenewDate: formData.certRenewDate, certExpireDate: formData.certExpireDate,
          remark: formData.remark, status: formData.status,
        })
        ElMessage.success('新增成功')
      } else {
        await updateDomain(formData.id, { ...formData })
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

async function handleDelete(row: DomainItem) {
  try {
    await ElMessageBox.confirm(`确定要删除域名"${row.domain}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteDomain(row.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

// —— 批量删除 ——
async function handleBatchDelete(rows: DomainItem[]) {
  const ids = rows.map(r => r.id)
  try {
    for (const id of ids) {
      await deleteDomain(id)
    }
    ElMessage.success(`已删除 ${ids.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 批量复制（Tab 分隔，可粘贴 Excel，排除敏感字段）——
function handleBatchCopy(rows: DomainItem[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['域名', '证书类型', '颁发机构', '更换日期', '到期日期', '状态', '备注']
  const lines = rows.map(row => [
    row.domain, row.certType || '', row.certIssuer || '',
    row.certRenewDate || '', row.certExpireDate || '',
    row.status, row.remark || '',
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
.stat-row { margin-bottom: var(--spacing-card); }
.filter-bar { display: flex; align-items: center; gap: var(--spacing-sm); flex-wrap: wrap; margin-bottom: var(--spacing-card); }
.filter-count { margin-left: auto; color: var(--text-secondary); font-size: var(--font-size-small); }
.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--spacing-card); }
.drawer-id { font-weight: 600; color: var(--text-primary); margin-right: 8px; }
.view-switcher { margin-right: 8px; }
.domain-name { color: var(--color-primary); font-weight: 500; cursor: pointer; }
.expire-cell { display: flex; align-items: center; gap: 8px; white-space: nowrap; }
</style>
