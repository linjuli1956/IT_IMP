<template>
  <div class="page-container">
    <PageHeader
      title="小程序管理"
      subtitle="小程序与邮箱凭据管理"
      :description="`管理各小程序的名称、绑定邮箱及密码。敏感信息默认脱敏显示。支持按名称/邮箱搜索。`"
    >
      <template #actions>
        <el-radio-group v-model="viewMode" size="small" class="view-switcher">
          <el-radio-button value="card">卡片总览</el-radio-button>
          <el-radio-button value="list">列表管理</el-radio-button>
        </el-radio-group>
        <el-button v-if="canEdit" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增小程序
        </el-button>
      </template>
    </PageHeader>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Cellphone" :color="vars.primary" :bg="vars.primaryLight" :value="miniappList.length" label="小程序总数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleCheck" :color="vars.success" :bg="vars.successLight" :value="activeCount" label="正常" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleClose" :color="vars.danger" :bg="vars.dangerLight" :value="inactiveCount" label="停用" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="PieChart" :color="vars.info" :bg="vars.infoLight" :value="activeRate" label="正常率" />
      </el-col>
    </el-row>

    <!-- 搜索+筛选栏（两种视图共享） -->
    <div class="card filter-bar">
      <el-input v-model="filterKeyword" placeholder="搜索名称/邮箱/备注" clearable style="width: 320px" :prefix-icon="Search" />
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 110px">
        <el-option v-for="s in miniappStatusOptions" :key="s" :label="s" :value="s" />
      </el-select>
      <span class="filter-count">{{ filteredMiniapps.length }} 个结果</span>
    </div>

    <!-- 卡片视图 -->
    <div v-if="viewMode === 'card'" class="card" v-loading="loading">
      <div class="card-grid" v-if="filteredMiniapps.length > 0">
        <ServiceAssetCard
          v-for="m in filteredMiniapps" :key="m.id"
          :title="m.name" :subtitle="m.email"
          :tags="miniappTags(m)" :fields="miniappFields(m)" :can-edit="canEdit"
          @click="openDrawer(m)" @edit="handleEdit(m)" @delete="handleDelete(m)"
        />
      </div>
      <EmptyState v-else description="暂无小程序数据" />
    </div>

    <!-- 列表视图 -->
    <div v-else class="card">
      <CrudTable
        v-if="filteredMiniapps.length > 0 || loading"
        :columns="columns"
        :data="filteredMiniapps"
        :loading="loading"
        :show-batch-copy="true"
        :show-batch-delete="canEdit"
        :show-actions="canEdit"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-copy="handleBatchCopy"
      >
        <template #name="{ row }">
          <RecordPreviewTooltip :title="row.name" :rows="buildMiniappPreviewRows(row)">
            <template #reference>
              <span class="miniapp-name" tabindex="0" :aria-label="`预览 ${row.name}`">{{ row.name }}</span>
            </template>
          </RecordPreviewTooltip>
        </template>
        <template #emailPassword="{ row }">
          <SensitiveValue :value="row.emailPassword" />
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </CrudTable>
      <EmptyState v-else description="暂无小程序数据" />
    </div>

    <!-- 详情抽屉（敏感字段按需显示） -->
    <AssetDetailDrawer v-model="drawerVisible" :title="currentRow?.name || '详情'" :can-edit="canEdit">
      <template #header>
        <span class="drawer-id">{{ currentRow?.email || '—' }}</span>
        <el-tag :type="getAssetStatusTagType(currentRow?.status || '')" size="small">{{ currentRow?.status }}</el-tag>
      </template>
      <el-descriptions v-if="currentRow" :column="2" border size="small">
        <el-descriptions-item label="小程序名称">{{ currentRow.name }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ currentRow.status }}</el-descriptions-item>
        <el-descriptions-item label="绑定邮箱">{{ currentRow.email || '—' }}</el-descriptions-item>
        <el-descriptions-item label="邮箱密码"><SensitiveValue :value="currentRow.emailPassword" /></el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ currentRow.remark || '—' }}</el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="drawerVisible = false">关闭</el-button>
        <el-button v-if="canEdit" type="primary" @click="handleEditFromDrawer">编辑</el-button>
        <el-button v-if="canEdit" type="danger" @click="handleDeleteFromDrawer">删除</el-button>
      </template>
    </AssetDetailDrawer>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" destroy-on-close>
      <el-form :model="formData" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="小程序名称" prop="name">
          <el-input v-model="formData.name" placeholder="请输入小程序名称" />
        </el-form-item>
        <el-form-item label="绑定邮箱" prop="email">
          <el-input v-model="formData.email" placeholder="如：demo@example.invalid" />
        </el-form-item>
        <el-form-item label="邮箱密码" prop="emailPassword">
          <el-input v-model="formData.emailPassword" type="password" show-password placeholder="请输入邮箱密码" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio v-for="s in miniappStatusOptions" :key="s" :value="s">{{ s }}</el-radio>
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
import { Plus, Cellphone, CircleCheck, CircleClose, PieChart, Search } from '@element-plus/icons-vue'
import { useMiniappData, type MiniappItem } from '~/composables/useMiniappData'
import { buildMiniappPreviewRows } from '~/utils/preview-utils'
import { getAssetStatusTagType } from '~/utils/asset-utils'
import { getApiErrorMessage } from '~/composables/useApi'
import type { ServiceTag, ServiceField } from '~/components/common/ServiceAssetCard.vue'

const { miniappList, loading, miniappStatusOptions, fetchMiniapps, addMiniapp, updateMiniapp, deleteMiniapp } = useMiniappData()

// —— 视图模式切换：默认卡片总览 ——
const viewMode = ref<'card' | 'list'>('card')

const canEdit = ref(false)

onMounted(() => {
  fetchMiniapps()
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
  danger: 'var(--color-danger)', dangerLight: 'var(--color-danger-light)',
  info: 'var(--color-info)', infoLight: 'var(--color-info-light)',
}

// —— 概览统计 ——
const activeCount = computed(() => miniappList.value.filter(m => m.status === '正常').length)
const inactiveCount = computed(() => miniappList.value.filter(m => m.status !== '正常').length)
const activeRate = computed(() => {
  if (miniappList.value.length === 0) return '0%'
  return Math.round(activeCount.value / miniappList.value.length * 100) + '%'
})

// —— 搜索 + 筛选（两种视图共享）——
const filterKeyword = ref('')
const filterStatus = ref('')

const filteredMiniapps = computed(() => {
  const kw = filterKeyword.value.toLowerCase()
  return miniappList.value.filter(m => {
    const haystack = [m.name, m.email, m.remark].filter(Boolean).join(' ').toLowerCase()
    const hitKw = !kw || haystack.includes(kw)
    const hitStatus = !filterStatus.value || m.status === filterStatus.value
    return hitKw && hitStatus
  })
})

// —— 卡片 Tag / Field 构造 ——
function miniappTags(m: MiniappItem): ServiceTag[] {
  return [{ label: m.status, type: m.status === '正常' ? 'success' : 'danger' }]
}
function miniappFields(m: MiniappItem): ServiceField[] {
  return [
    { label: '管理平台', value: '微信公众平台' },
    { label: '备注', value: m.remark || '—' },
  ]
}

// —— 列表视图列配置 ——
const columns = [
  { prop: 'name', label: '小程序名称', minWidth: 200, slot: 'name' },
  { prop: 'email', label: '绑定邮箱', minWidth: 220 },
  { prop: 'emailPassword', label: '邮箱密码', width: 200, slot: 'emailPassword' },
  { prop: 'status', label: '状态', width: 90, align: 'center' as const, slot: 'status' },
  { prop: 'remark', label: '备注', minWidth: 180 },
]

// —— 详情抽屉 ——
const drawerVisible = ref(false)
const currentRow = ref<MiniappItem | null>(null)
function openDrawer(row: MiniappItem) {
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

const formData = reactive<MiniappItem>({
  id: 0, name: '', email: '', emailPassword: '', remark: '', status: '正常',
})

const rules = {
  name: [{ required: true, message: '请输入小程序名称', trigger: 'blur' }],
  email: [{ required: true, message: '请输入绑定邮箱', trigger: 'blur' }],
  emailPassword: [{ required: true, message: '请输入邮箱密码', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function handleAdd() {
  dialogTitle.value = '新增小程序'
  Object.assign(formData, { id: 0, name: '', email: '', emailPassword: '', remark: '', status: '正常' })
  dialogVisible.value = true
}

function handleEdit(row: MiniappItem) {
  dialogTitle.value = '编辑小程序'
  Object.assign(formData, row)
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        await addMiniapp({
          name: formData.name, email: formData.email, emailPassword: formData.emailPassword,
          remark: formData.remark, status: formData.status,
        })
        ElMessage.success('新增成功')
      } else {
        await updateMiniapp(formData.id, { ...formData })
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

async function handleDelete(row: MiniappItem) {
  try {
    await ElMessageBox.confirm(`确定要删除"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteMiniapp(row.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

// —— 批量删除 ——
async function handleBatchDelete(rows: MiniappItem[]) {
  const ids = rows.map(r => r.id)
  try {
    for (const id of ids) {
      await deleteMiniapp(id)
    }
    ElMessage.success(`已删除 ${ids.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 批量复制（Tab 分隔，可粘贴 Excel，排除敏感字段）——
function handleBatchCopy(rows: MiniappItem[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['小程序名称', '绑定邮箱', '状态', '备注']
  const lines = rows.map(row => [
    row.name, row.email, row.status, row.remark || '',
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
.miniapp-name { color: var(--color-primary); font-weight: 500; cursor: pointer; }
</style>
