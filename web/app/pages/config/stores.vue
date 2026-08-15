<template>
  <div class="page-container">
    <PageHeader
      title="部门门店机构管理"
      subtitle="组织架构与门店数据源"
      :description="`管理各部门、门店、机构的名称和排序。门店数据同步至计提模板等模块，禁用的门店不会出现在其他模块的下拉选项中。`"
    >
      <template #actions>
        <el-button v-if="canEdit" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增部门/门店/机构
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索名称或机构代码"
        clearable
        :prefix-icon="Search"
        style="width: 260px"
      />
    </div>

    <div class="card">
      <CrudTable
        v-if="filteredStoreList.length > 0 || loading"
        :columns="columns"
        :data="filteredStoreList"
        :loading="loading"
        :show-selection="canEdit"
        :show-actions="canEdit"
        :action-width="160"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      >
        <template #status="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
            {{ row.status === 1 ? '启用' : '禁用' }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" text type="primary" @click="handleEdit(row)">编辑</el-button>
          <el-button size="small" text @click="handleToggleStatus(row)">
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" text type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>
      <EmptyState v-else description="暂无门店数据" />
    </div>

    <EditDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="fields"
      :form-data="formData"
      :rules="rules"
      :saving="saving"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { Plus, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getApiErrorMessage } from '~/composables/useApi'

// 从共享数据源获取门店数据
const { storeList, loading, fetchStores, addStore, updateStore, deleteStore, toggleStatus } = useStoreData()

const canEdit = ref(false)
const searchKeyword = ref('')

const filteredStoreList = computed(() => {
  if (!searchKeyword.value) return storeList.value
  const kw = searchKeyword.value.toLowerCase()
  return storeList.value.filter((s: any) =>
    (s.name || '').toLowerCase().includes(kw) ||
    (s.code || '').toLowerCase().includes(kw)
  )
})

onMounted(() => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchStores()
})

// 列配置
const columns = [
  { prop: 'code', label: '机构代码', width: 120 },
  { prop: 'name', label: '名称', minWidth: 200 },
  { prop: 'sort', label: '排序', width: 100, align: 'center' as const },
  { prop: 'status', label: '状态', width: 100, align: 'center' as const, slot: 'status' },
]

// 表单字段配置
const fields = [
  { prop: 'code', label: '机构代码', type: 'input' as const, placeholder: '如 10001（可选）' },
  { prop: 'name', label: '名称', type: 'input' as const, placeholder: '请输入部门、门店或机构名称' },
  { prop: 'sort', label: '排序', type: 'number' as const, min: 0, max: 999 },
]

// 验证规则
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  sort: [{ required: true, message: '请输入排序', trigger: 'blur' }],
}

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isEdit = ref(false)
const saving = ref(false)
const formData = reactive({
  id: 0,
  name: '',
  code: '',
  sort: 0,
})

function handleAdd() {
  isEdit.value = false
  dialogTitle.value = '新增部门/门店/机构'
  formData.id = 0
  formData.name = ''
  formData.code = ''
  formData.sort = storeList.value.length + 1
  dialogVisible.value = true
}

function handleEdit(row: any) {
  isEdit.value = true
  dialogTitle.value = '编辑部门/门店/机构'
  formData.id = row.id
  formData.name = row.name
  formData.code = row.code || ''
  formData.sort = row.sort
  dialogVisible.value = true
}

async function handleSave(data: Record<string, any>) {
  saving.value = true
  try {
    if (isEdit.value) {
      await updateStore(formData.id, data)
      ElMessage.success('修改成功')
    } else {
      await addStore({ name: data.name, code: data.code, sort: data.sort })
      ElMessage.success('新增成功')
    }
    dialogVisible.value = false
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteStore(row.id)
    ElMessage.success('删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(getApiErrorMessage(error))
    }
  }
}

async function handleBatchDelete(rows: any[]) {
  try {
    for (const r of rows) {
      await deleteStore(r.id)
    }
    ElMessage.success(`已删除 ${rows.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

async function handleToggleStatus(row: any) {
  try {
    await toggleStatus(row.id)
    ElMessage.success(row.status === 1 ? '已禁用' : '已启用')
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

</script>

<style scoped>
</style>
