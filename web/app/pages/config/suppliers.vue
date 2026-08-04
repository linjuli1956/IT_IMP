<template>
  <div class="page-container">
    <PageHeader title="客户管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增客户
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理合作方信息（运营商、设备商、服务商等）</p>
        <p>2. 客户类型支持6种预设+自定义输入</p>
        <p>3. 不同类型有独有配色标识，便于区分</p>
        <p>4. 合同管理模块将引用此处的客户信息</p>
      </div>
    </el-alert>

    <div class="card">
      <CrudTable
        :columns="columns"
        :data="supplierList"
        :loading="loading"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      >
        <template #type="{ row }">
          <el-tag size="small" effect="plain" :style="getTypeStyle(row.type)">{{ row.type }}</el-tag>
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
      width="600px"
      @save="handleSave"
    />
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useSupplierData } from '~/composables/useSupplierData'
import { getApiErrorMessage } from '~/composables/useApi'

const { supplierList, loading, fetchSuppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplierData()

onMounted(() => {
  fetchSuppliers()
})

// 列配置
const columns = [
  { prop: 'name', label: '名称', minWidth: 200 },
  { prop: 'contact', label: '联系人', width: 100 },
  { prop: 'phone', label: '电话', width: 140 },
  { prop: 'address', label: '地址', minWidth: 200 },
  { prop: 'type', label: '类型', minWidth: 120, align: 'center' as const, slot: 'type' },
  { prop: 'remark', label: '备注', minWidth: 150 },
]

// 表单字段配置
const fields = [
  { prop: 'name', label: '名称', type: 'input' as const, placeholder: '请输入客户名称' },
  { prop: 'contact', label: '联系人', type: 'input' as const, placeholder: '请输入联系人姓名' },
  { prop: 'phone', label: '电话', type: 'input' as const, placeholder: '请输入联系电话' },
  { prop: 'address', label: '地址', type: 'input' as const, placeholder: '请输入地址' },
  { prop: 'type', label: '类型', type: 'select' as const, placeholder: '请选择或输入类型', allowCreate: true, options: [
    { label: '运营商', value: '运营商' },
    { label: '设备商', value: '设备商' },
    { label: '服务商', value: '服务商' },
    { label: '施工方/集成商', value: '施工方/集成商' },
    { label: '软件供应商', value: '软件供应商' },
    { label: '其他', value: '其他' },
  ]},
  { prop: 'remark', label: '备注', type: 'textarea' as const, placeholder: '请输入备注信息' },
]

// 类型颜色映射（引用 tokens.css 业务类型配色变量）
const typeColorMap: Record<string, string> = {
  '运营商': 'var(--type-operator)',
  '设备商': 'var(--type-equipment)',
  '服务商': 'var(--type-service)',
  '施工方/集成商': 'var(--type-integrator)',
  '软件供应商': 'var(--type-software)',
  '其他': 'var(--type-other)',
}

function getTypeStyle(type: string) {
  const color = typeColorMap[type] || typeColorMap['其他']
  return {
    backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
    color: color,
    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
  }
}

// 验证规则
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择类型', trigger: 'change' }],
}

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formData = reactive({
  id: 0,
  name: '',
  contact: '',
  phone: '',
  address: '',
  type: '',
  remark: '',
})

function handleAdd() {
  dialogTitle.value = '新增客户'
  formData.id = 0
  formData.name = ''
  formData.contact = ''
  formData.phone = ''
  formData.address = ''
  formData.type = ''
  formData.remark = ''
  dialogVisible.value = true
}

function handleEdit(row: any) {
  dialogTitle.value = '编辑客户'
  formData.id = row.id
  formData.name = row.name
  formData.contact = row.contact
  formData.phone = row.phone
  formData.address = row.address
  formData.type = row.type
  formData.remark = row.remark
  dialogVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    if (formData.id === 0) {
      await addSupplier({
        name: formData.name,
        contact: formData.contact,
        phone: formData.phone,
        address: formData.address,
        type: formData.type,
        remark: formData.remark,
      })
      ElMessage.success('新增成功')
    } else {
      await updateSupplier(formData.id, { ...formData })
      ElMessage.success('编辑成功')
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
    await deleteSupplier(row.id)
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
      await deleteSupplier(r.id)
    }
    ElMessage.success(`已删除 ${rows.length} 项`)
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  }
}
</script>

<style scoped>
</style>
