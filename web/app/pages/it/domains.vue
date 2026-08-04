<template>
  <div class="page-container">
    <PageHeader title="域名管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增域名
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理阿里云域名及其主账号凭证信息</p>
        <p>2. 记录SSL证书类型（DV/OV/EV）、颁发机构、更换日期和到期日期</p>
        <p>3. 敏感信息（主账号、主账号密码）默认脱敏显示，点击眼睛图标可切换显示/隐藏</p>
        <p>4. 证书到期提醒：30天内标橙色，7天内标红色，已过期标红色</p>
      </div>
    </el-alert>

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

    <!-- 搜索栏 -->
    <div class="card filter-bar">
      <el-input v-model="filterKeyword" placeholder="搜索域名/账号/颁发机构/备注" clearable style="width: 360px" />
    </div>

    <!-- 表格 -->
    <div class="card">
      <CrudTable
        :columns="columns"
        :data="filteredDomains"
        :loading="loading"
        :stripe="false"
        :row-class-name="getDomainRowClass"
        :show-batch-copy="true"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-copy="handleBatchCopy"
      >
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
            <span class="expire-date">{{ row.certExpireDate || '—' }}</span>
            <el-tag v-if="row.certExpireDate" size="small" :type="getExpireTagType(row.certExpireDate)">
              {{ getExpireLabel(row.certExpireDate) }}
            </el-tag>
          </div>
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </CrudTable>
    </div>

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
import { Plus, Document, CircleCheck, WarningFilled, CircleClose } from '@element-plus/icons-vue'
import { useDomainData, certTypeOptions, certTypeTagMap, type DomainItem } from '~/composables/useDomainData'
import { getContractStatus, getDaysLeft } from '~/composables/useContractData'
import { getApiErrorMessage } from '~/composables/useApi'

const { domainList, loading, domainStatusOptions, fetchDomains, addDomain, updateDomain, deleteDomain } = useDomainData()

onMounted(() => {
  fetchDomains()
})

// —— CSS 变量颜色引用 ——
const vars = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)',
  successLight: 'var(--color-success-light)',
  warning: 'var(--color-warning)',
  warningLight: 'var(--color-warning-light)',
  danger: 'var(--color-danger)',
  dangerLight: 'var(--color-danger-light)',
}

// —— 概览统计 ——
const activeCount = computed(() => domainList.value.filter(d => d.status === '正常').length)
const expiringCount = computed(() => domainList.value.filter(d => {
  if (!d.certExpireDate) return false
  const days = getDaysLeft(d.certExpireDate)
  return days !== null && days > 0 && days <= 30
}).length)
const expiredCount = computed(() => domainList.value.filter(d => {
  if (!d.certExpireDate) return false
  return getContractStatus(d.certExpireDate) === 'expired'
}).length)

// —— 列头筛选 ——
const certTypeFilters = computed(() =>
  [...new Set(domainList.value.map(d => d.certType).filter(Boolean))]
    .map(v => ({ text: v, value: v }))
)
const certIssuerFilters = computed(() =>
  [...new Set(domainList.value.map(d => d.certIssuer).filter(Boolean))]
    .map(v => ({ text: v, value: v }))
)
const statusFilters = [
  { text: '正常', value: '正常' },
  { text: '停用', value: '停用' },
]

const columns = computed(() => [
  { prop: 'domain', label: '域名', minWidth: 200 },
  { prop: 'mainAccount', label: '主账号', width: 180, slot: 'mainAccount' },
  { prop: 'mainPassword', label: '主账号密码', width: 180, slot: 'mainPassword' },
  { prop: 'certType', label: '证书类型', width: 90, align: 'center' as const, slot: 'certType', filters: certTypeFilters.value, filterMethod: (v: any, r: any) => r.certType === v },
  { prop: 'certIssuer', label: '颁发机构', width: 140, filters: certIssuerFilters.value, filterMethod: (v: any, r: any) => r.certIssuer === v },
  { prop: 'certRenewDate', label: '更换日期', width: 120 },
  { prop: 'certExpireDate', label: '到期日期', minWidth: 200, slot: 'certExpireDate' },
  { prop: 'status', label: '状态', width: 90, align: 'center' as const, slot: 'status', filters: statusFilters, filterMethod: (v: any, r: any) => r.status === v },
  { prop: 'remark', label: '备注', minWidth: 150 },
])

// —— 证书到期提醒（复用合同管理逻辑）——
function getExpireTagType(expireDate: string) {
  const status = getContractStatus(expireDate)
  if (status === 'expired') return 'danger'
  if (status === 'expiring') return 'warning'
  return 'success'
}

function getExpireLabel(expireDate: string) {
  const status = getContractStatus(expireDate)
  if (status === 'expired') return '已过期'
  const days = getDaysLeft(expireDate)
  if (status === 'expiring') return `${days}天后到期`
  return '有效'
}

// —— 搜索 ——
const filterKeyword = ref('')

const filteredDomains = computed(() => {
  if (!filterKeyword.value) return domainList.value
  const kw = filterKeyword.value.toLowerCase()
  return domainList.value.filter(d => {
    const haystack = [d.domain, d.mainAccount, d.certIssuer, d.remark]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(kw)
  })
})

// —— 弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive<DomainItem>({
  id: 0,
  domain: '',
  mainAccount: '',
  mainPassword: '',
  certType: '',
  certIssuer: '',
  certRenewDate: '',
  certExpireDate: '',
  remark: '',
  status: '正常',
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

function handleEdit(row: any) {
  const d = row as DomainItem
  dialogTitle.value = '编辑域名'
  Object.assign(formData, d)
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        await addDomain({
          domain: formData.domain,
          mainAccount: formData.mainAccount,
          mainPassword: formData.mainPassword,
          certType: formData.certType,
          certIssuer: formData.certIssuer,
          certRenewDate: formData.certRenewDate,
          certExpireDate: formData.certExpireDate,
          remark: formData.remark,
          status: formData.status,
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

async function handleDelete(row: any) {
  const d = row as DomainItem
  try {
    await ElMessageBox.confirm(`确定要删除域名"${d.domain}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteDomain(d.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

async function handleBatchDelete(rows: any[]) {
  const ids = (rows as DomainItem[]).map(r => r.id)
  try {
    for (const id of ids) {
      await deleteDomain(id)
    }
    ElMessage.success(`已删除 ${ids.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 证书类型行底色 ——
const certTypeBgMap: Record<string, string> = {
  'DV': 'cert-type-dv',
  'OV': 'cert-type-ov',
  'EV': 'cert-type-ev',
}
function getDomainRowClass({ row }: { row: any }) {
  return certTypeBgMap[row.certType] || 'cert-type-none'
}

// —— 批量复制（Tab分隔，可粘贴Excel，排除敏感字段）——
function handleBatchCopy(rows: any[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['域名', '证书类型', '颁发机构', '更换日期', '到期日期', '状态', '备注']
  const lines = (rows as DomainItem[]).map(row => [
    row.domain, row.certType || '—', row.certIssuer || '—',
    row.certRenewDate || '—', row.certExpireDate || '—',
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
.expire-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.expire-date {
  flex-shrink: 0;
}

/* 证书类型行底色 */
:deep(.cert-type-dv > td) { background: var(--cert-type-dv-bg) !important; }
:deep(.cert-type-ov > td) { background: var(--cert-type-ov-bg) !important; }
:deep(.cert-type-ev > td) { background: var(--cert-type-ev-bg) !important; }
:deep(.cert-type-none > td) { background: var(--cert-type-none-bg) !important; }
:deep(.cert-type-dv:hover > td) { background: var(--cert-type-dv-hover) !important; }
:deep(.cert-type-ov:hover > td) { background: var(--cert-type-ov-hover) !important; }
:deep(.cert-type-ev:hover > td) { background: var(--cert-type-ev-hover) !important; }
:deep(.cert-type-none:hover > td) { background: var(--cert-type-none-hover) !important; }
</style>
