<template>
  <div class="page-container">
    <PageHeader title="小程序管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增小程序
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理各小程序的名称、绑定邮箱及邮箱密码</p>
        <p>2. 敏感信息（邮箱密码）默认脱敏显示，点击眼睛图标可切换显示/隐藏</p>
        <p>3. 支持按名称/邮箱搜索，状态列可筛选</p>
      </div>
    </el-alert>

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

    <!-- 搜索栏 -->
    <div class="card filter-bar">
      <el-input v-model="filterKeyword" placeholder="搜索名称/邮箱/备注" clearable style="width: 360px" />
    </div>

    <!-- 表格 -->
    <div class="card">
      <CrudTable
        :columns="columns"
        :data="filteredMiniapps"
        :loading="loading"
        :stripe="false"
        :row-class-name="getMiniappRowClass"
        :show-batch-copy="true"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
        @batch-copy="handleBatchCopy"
      >
        <template #emailPassword="{ row }">
          <SensitiveValue :value="row.emailPassword" />
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
      </CrudTable>
    </div>

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
import { Plus, Cellphone, CircleCheck, CircleClose, PieChart } from '@element-plus/icons-vue'
import { useMiniappData, type MiniappItem } from '~/composables/useMiniappData'
import { getApiErrorMessage } from '~/composables/useApi'

const { miniappList, loading, miniappStatusOptions, fetchMiniapps, addMiniapp, updateMiniapp, deleteMiniapp } = useMiniappData()

onMounted(() => {
  fetchMiniapps()
})

// —— CSS 变量颜色引用 ——
const vars = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)',
  successLight: 'var(--color-success-light)',
  danger: 'var(--color-danger)',
  dangerLight: 'var(--color-danger-light)',
  info: 'var(--color-info)',
  infoLight: 'var(--color-info-light)',
}

// —— 概览统计 ——
const activeCount = computed(() => miniappList.value.filter(m => m.status === '正常').length)
const inactiveCount = computed(() => miniappList.value.filter(m => m.status !== '正常').length)
const activeRate = computed(() => {
  if (miniappList.value.length === 0) return '0%'
  return Math.round(activeCount.value / miniappList.value.length * 100) + '%'
})

// —— 列头筛选 ——
const statusFilters = [
  { text: '正常', value: '正常' },
  { text: '停用', value: '停用' },
]

const columns = computed(() => [
  { prop: 'name', label: '小程序名称', minWidth: 200 },
  { prop: 'email', label: '绑定邮箱', minWidth: 220 },
  { prop: 'emailPassword', label: '邮箱密码', width: 200, slot: 'emailPassword' },
  { prop: 'status', label: '状态', width: 90, align: 'center' as const, slot: 'status', filters: statusFilters, filterMethod: (v: any, r: any) => r.status === v },
  { prop: 'remark', label: '备注', minWidth: 180 },
])

// —— 搜索 ——
const filterKeyword = ref('')

const filteredMiniapps = computed(() => {
  if (!filterKeyword.value) return miniappList.value
  const kw = filterKeyword.value.toLowerCase()
  return miniappList.value.filter(m => {
    const haystack = [m.name, m.email, m.remark]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(kw)
  })
})

// —— 弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive<MiniappItem>({
  id: 0,
  name: '',
  email: '',
  emailPassword: '',
  remark: '',
  status: '正常',
})

const rules = {
  name: [{ required: true, message: '请输入小程序名称', trigger: 'blur' }],
  email: [{ required: true, message: '请输入绑定邮箱', trigger: 'blur' }],
  emailPassword: [{ required: true, message: '请输入邮箱密码', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function handleAdd() {
  dialogTitle.value = '新增小程序'
  Object.assign(formData, {
    id: 0, name: '', email: '', emailPassword: '', remark: '', status: '正常',
  })
  dialogVisible.value = true
}

function handleEdit(row: any) {
  const m = row as MiniappItem
  dialogTitle.value = '编辑小程序'
  Object.assign(formData, m)
  dialogVisible.value = true
}

function handleSave() {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        await addMiniapp({
          name: formData.name,
          email: formData.email,
          emailPassword: formData.emailPassword,
          remark: formData.remark,
          status: formData.status,
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

async function handleDelete(row: any) {
  const m = row as MiniappItem
  try {
    await ElMessageBox.confirm(`确定要删除"${m.name}"吗？`, '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    await deleteMiniapp(m.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

async function handleBatchDelete(rows: any[]) {
  const ids = (rows as MiniappItem[]).map(r => r.id)
  try {
    for (const id of ids) {
      await deleteMiniapp(id)
    }
    ElMessage.success(`已删除 ${ids.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 状态行底色 ——
function getMiniappRowClass({ row }: { row: any }) {
  return row.status === '正常' ? 'miniapp-active' : 'miniapp-inactive'
}

// —— 批量复制（Tab分隔，可粘贴Excel，排除敏感字段）——
function handleBatchCopy(rows: any[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['小程序名称', '绑定邮箱', '状态', '备注']
  const lines = (rows as MiniappItem[]).map(row => [
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
/* 状态行底色 */
:deep(.miniapp-active > td) { background: var(--miniapp-active-bg) !important; }
:deep(.miniapp-inactive > td) { background: var(--miniapp-inactive-bg) !important; }
:deep(.miniapp-active:hover > td) { background: var(--miniapp-active-hover) !important; }
:deep(.miniapp-inactive:hover > td) { background: var(--miniapp-inactive-hover) !important; }
</style>
