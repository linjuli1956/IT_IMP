<template>
  <div class="page-container">
    <PageHeader
      title="用户管理"
      subtitle="账号与角色权限管理"
      :description="`角色分为管理员（全部权限）、操作员（日常操作）、查看者（只读）。默认管理员 admin 不可删除/重置密码；新增用户默认密码 123456，可通过「重置密码」恢复。`"
    >
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增用户
        </el-button>
      </template>
    </PageHeader>

    <div class="filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名或姓名"
        clearable
        :prefix-icon="Search"
        style="width: 240px"
      />
    </div>

    <div class="card">
      <CrudTable
        v-if="filteredUserList.length > 0 || tableLoading"
        :columns="columns"
        :data="filteredUserList"
        :loading="tableLoading"
        :action-width="140"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      >
        <template #role="{ row }">
          <el-tag size="small" :type="getRoleTagType(row.role)">{{ row.role }}</el-tag>
        </template>
        <template #status="{ row }">
          <el-switch
            :model-value="row.status === 1"
            :disabled="row.username === 'admin' || statusLoadingId === row.id"
            @change="(val) => toggleStatus(row, !!val)"
          />
        </template>
        <template #actions="{ row }">
          <el-button size="small" @click="handleEdit(row)">编辑</el-button>
          <el-dropdown trigger="click" @command="(cmd) => handleActionCommand(cmd as string, row)">
            <el-button size="small" text :disabled="resetLoadingId === row.id">
              更多<el-icon class="el-icon--right"><ArrowDown /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  command="reset"
                  :disabled="row.username === 'admin'"
                >
                  <el-icon><Key /></el-icon>
                  重置密码
                </el-dropdown-item>
                <el-dropdown-item
                  command="delete"
                  divided
                  :disabled="row.username === 'admin'"
                >
                  <span style="color: var(--color-danger)">删除</span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </CrudTable>
      <EmptyState
        v-else
        description="未找到匹配用户"
      />
    </div>

    <EditDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="fields"
      :form-data="formData"
      :rules="rules"
      :saving="saving"
      :tip="formData.id === 0 ? '新增用户默认密码为 123456' : ''"
      width="520px"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Key, Search, ArrowDown } from '@element-plus/icons-vue'
import type { User } from '~/types/auth'
import { useApi, getApiErrorMessage } from '~/composables/useApi'

const api = useApi()

// —— 表格列定义 ——
const columns = [
  { prop: 'username', label: '用户名', width: 140 },
  { prop: 'name', label: '姓名', width: 120 },
  { prop: 'role', label: '角色', width: 100, align: 'center' as const, slot: 'role' },
  { prop: 'status', label: '状态', width: 80, align: 'center' as const, slot: 'status' },
  { prop: 'lastLogin', label: '最后登录', minWidth: 160 },
  { prop: 'createdAt', label: '创建时间', minWidth: 160 },
]

// —— 表单字段 ——
const fields = [
  { prop: 'username', label: '用户名', type: 'input' as const, placeholder: '请输入登录用户名' },
  { prop: 'name', label: '姓名', type: 'input' as const, placeholder: '请输入真实姓名' },
  {
    prop: 'role',
    label: '角色',
    type: 'select' as const,
    placeholder: '请选择角色',
    options: [
      { label: '管理员', value: '管理员' },
      { label: '操作员', value: '操作员' },
      { label: '查看者', value: '查看者' },
    ],
  },
]

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
}

function getRoleTagType(role: string) {
  if (role === '管理员') return 'danger'
  if (role === '操作员') return 'warning'
  return 'info'
}

// —— 操作下拉菜单 ——
function handleActionCommand(command: string, row: any) {
  if (command === 'reset') handleResetPassword(row)
  else if (command === 'delete') handleDelete(row)
}

// —— 数据列表 ——
const userList = ref<User[]>([])
const tableLoading = ref(false)

// —— 搜索筛选 ——
const searchKeyword = ref('')
const filteredUserList = computed(() => {
  if (!searchKeyword.value) return userList.value
  const kw = searchKeyword.value.toLowerCase()
  return userList.value.filter(u =>
    u.username.toLowerCase().includes(kw) ||
    u.name.toLowerCase().includes(kw)
  )
})

async function fetchUsers() {
  tableLoading.value = true
  try {
    const data = await api.get<User[]>('/api/users')
    userList.value = data
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    tableLoading.value = false
  }
}

onMounted(() => {
  fetchUsers()
})

// —— 新增 / 编辑弹窗 ——
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formData = reactive({
  id: 0,
  username: '',
  name: '',
  role: '',
  status: 1,
})

function handleAdd() {
  dialogTitle.value = '新增用户'
  Object.assign(formData, { id: 0, username: '', name: '', role: '', status: 1 })
  dialogVisible.value = true
}

function handleEdit(row: any) {
  const user = row as User
  dialogTitle.value = '编辑用户'
  Object.assign(formData, {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status,
  })
  dialogVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formData.id === 0) {
      // 新增用户（不需要密码字段，后端设置默认密码 123456）
      await api.post('/api/users', {
        username: formData.username,
        name: formData.name,
        role: formData.role,
      })
      ElMessage.success('新增成功，默认密码为 123456')
    } else {
      // 编辑用户
      await api.put(`/api/users/${formData.id}`, {
        name: formData.name,
        role: formData.role,
        status: formData.status,
      })
      ElMessage.success('编辑成功')
    }
    dialogVisible.value = false
    await fetchUsers()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    saving.value = false
  }
}

// —— 删除 ——
function handleDelete(row: any) {
  const user = row as User
  if (user.username === 'admin') {
    ElMessage.warning('默认管理员账号不可删除')
    return
  }
  ElMessageBox.confirm(`确定要删除用户"${user.name}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        await api.delete(`/api/users/${user.id}`)
        ElMessage.success('删除成功')
        await fetchUsers()
      } catch (error) {
        ElMessage.error(getApiErrorMessage(error))
      }
    })
    .catch(() => {})
}

// —— 批量删除 ——
async function handleBatchDelete(rows: User[]) {
  const filtered = rows.filter((r) => r.username !== 'admin')
  if (filtered.length < rows.length) {
    ElMessage.warning('默认管理员账号不可删除，已跳过')
  }
  if (filtered.length === 0) return

  try {
    await Promise.all(filtered.map((r) => api.delete(`/api/users/${r.id}`)))
    ElMessage.success(`已删除 ${filtered.length} 项`)
    await fetchUsers()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}

// —— 启用/禁用 ——
const statusLoadingId = ref<number | null>(null)

async function toggleStatus(row: any, val: boolean) {
  const user = row as User
  statusLoadingId.value = user.id
  try {
    await api.put(`/api/users/${user.id}`, {
      name: user.name,
      role: user.role,
      status: val ? 1 : 0,
    })
    ElMessage.success(`${user.name} 已${val ? '启用' : '禁用'}`)
    await fetchUsers()
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    statusLoadingId.value = null
  }
}

// —— 重置密码 ——
const resetLoadingId = ref<number | null>(null)

function handleResetPassword(row: any) {
  const user = row as User
  if (user.username === 'admin') {
    ElMessage.warning('默认管理员账号不可重置密码')
    return
  }
  ElMessageBox.confirm(
    `确定将用户 "${user.name}" 的密码重置为 123456 吗？`,
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
    .then(async () => {
      resetLoadingId.value = user.id
      try {
        await api.post(`/api/users/${user.id}/reset-password`)
        ElMessage.success('密码已重置为 123456')
      } catch (error) {
        ElMessage.error(getApiErrorMessage(error))
      } finally {
        resetLoadingId.value = null
      }
    })
    .catch(() => {})
}
</script>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
