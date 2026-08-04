<template>
  <div class="page-container">
    <PageHeader title="部门门店机构管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增部门/门店/机构
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理各部门、门店、机构的名称和排序</p>
        <p>2. 门店数据同步至计提模板等模块，新增/修改后其他页面自动更新</p>
        <p>3. 禁用的门店不会出现在其他模块的下拉选项中</p>
        <p>4. 支持按排序号排列，序号越小越靠前</p>
      </div>
    </el-alert>

    <div class="card">
      <CrudTable
        :columns="columns"
        :data="storeList"
        :loading="loading"
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
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          <el-button
            size="small"
            :type="row.status === 1 ? 'warning' : 'success'"
            @click="handleToggleStatus(row)"
          >
            {{ row.status === 1 ? '禁用' : '启用' }}
          </el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>
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
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getApiErrorMessage } from '~/composables/useApi'

// 从共享数据源获取门店数据
const { storeList, loading, fetchStores, addStore, updateStore, deleteStore, toggleStatus } = useStoreData()

onMounted(() => {
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
