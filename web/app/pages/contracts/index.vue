<template>
  <div class="page-container">
    <PageHeader title="合同管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增合同
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 管理与客户签订的各类合同（宽带/设备采购/项目/采购/维保）</p>
        <p>2. 上传合同PDF附件，支持拖拽上传</p>
        <p>3. 到期提醒：30天内标橙色，7天内标红色，首页仪表盘同步展示</p>
        <p>4. 点击文件名可查看已上传的合同文件</p>
      </div>
    </el-alert>

    <!-- 筛选区 -->
    <div class="card filter-bar">
      <el-select v-model="filterType" placeholder="合同类型" clearable style="width: 140px">
        <el-option v-for="t in contractTypes" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="到期状态" clearable style="width: 140px">
        <el-option label="即将到期(30天内)" value="expiring" />
        <el-option label="已过期" value="expired" />
        <el-option label="有效" value="active" />
      </el-select>
      <el-input v-model="filterKeyword" placeholder="搜索标题/客户" clearable style="width: 220px" />
    </div>

    <!-- 列表 -->
    <div class="card" v-loading="loading">
      <CrudTable
        :columns="columns"
        :data="filteredContracts"
        @edit="handleEdit"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      >
        <template #type="{ row }">
          <el-tag size="small" effect="plain" :style="getTypeStyle(row.type)">{{ row.type }}</el-tag>
        </template>
        <template #amount="{ row }">
          <span class="amount-text">¥ {{ row.amount.toLocaleString() }}</span>
        </template>
        <template #expireDate="{ row }">
          <div class="expire-cell">
            <span class="expire-date">{{ row.expireDate }}</span>
            <el-tag
              size="small"
              :type="getStatusTagType(row.expireDate)"
            >
              {{ getStatusLabel(row.expireDate) }}
            </el-tag>
          </div>
        </template>
        <template #fileName="{ row }">
          <el-link v-if="row.fileName" type="primary" :underline="false" @click="handleViewFile(row)">
            <el-icon><Document /></el-icon>
            {{ row.fileName }}
          </el-link>
          <span v-else class="text-placeholder">未上传</span>
        </template>
      </CrudTable>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="640px" destroy-on-close>
      <el-form :model="formData" label-width="100px" :rules="rules" ref="formRef">
        <el-form-item label="合同标题" prop="title">
          <el-input v-model="formData.title" placeholder="请输入合同标题" />
        </el-form-item>
        <el-form-item label="客户名称" prop="supplierName">
          <el-select v-model="formData.supplierName" filterable allow-create placeholder="请选择或输入客户名称" style="width: 100%">
            <el-option v-for="s in supplierOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="合同类型" prop="type">
              <el-select v-model="formData.type" placeholder="请选择类型" style="width: 100%">
                <el-option v-for="t in contractTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="合同金额" prop="amount">
              <el-input-number v-model="formData.amount" :min="0" :precision="2" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="签订日期" prop="signDate">
              <el-date-picker v-model="formData.signDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="到期日期" prop="expireDate">
              <el-date-picker v-model="formData.expireDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width: 100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="合同附件">
          <div class="upload-area">
            <div v-if="formData.fileName" class="current-file">
              <el-icon color="var(--color-primary)"><Document /></el-icon>
              <span class="file-name">{{ formData.fileName }}</span>
              <el-button text type="danger" size="small" @click="formData.fileName = ''">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <DragUpload
              v-else
              :max-count="1"
              accept=".pdf"
              hint-text="将合同PDF拖拽到此处，或点击选择"
              sub-hint="支持 PDF 格式"
              @files-change="onFileChange"
            />
          </div>
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
import { Plus, Document, Close } from '@element-plus/icons-vue'
import { useContractData, getContractStatus, getDaysLeft, contractTypes, type Contract } from '~/composables/useContractData'

const { contractList, loading, fetchContracts, addContract, updateContract, deleteContract } = useContractData()

// 页面加载时获取合同列表
onMounted(() => {
  fetchContracts()
})

// 客户名称选项（与客户管理页面保持一致）
const supplierOptions = [
  '示例电信服务商',
  '示例联通服务商',
  '示例移动服务商',
  '示例广电服务商',
  '华为技术有限公司',
  '锐捷网络股份有限公司',
  '深信服科技股份有限公司',
]

// 类型颜色映射（引用 tokens.css 业务类型配色变量）
const typeColorMap: Record<string, string> = {
  '宽带': 'var(--type-operator)',
  '设备采购': 'var(--type-equipment)',
  '项目': 'var(--type-service)',
  '采购': 'var(--type-integrator)',
  '维保': 'var(--type-software)',
}

function getTypeStyle(type: string) {
  const color = typeColorMap[type] || 'var(--type-other)'
  return {
    backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
    color: color,
    borderColor: `color-mix(in srgb, ${color} 25%, transparent)`,
  }
}

// 状态计算
function getStatusTagType(expireDate: string) {
  const status = getContractStatus(expireDate)
  if (status === 'expired') return 'danger'
  if (status === 'expiring') return 'warning'
  return 'success'
}

function getStatusLabel(expireDate: string) {
  const status = getContractStatus(expireDate)
  if (status === 'expired') return '已过期'
  const days = getDaysLeft(expireDate)
  if (status === 'expiring') return `${days}天后到期`
  return '有效'
}

// 列配置
const columns = [
  { prop: 'title', label: '合同标题', minWidth: 180 },
  { prop: 'supplierName', label: '客户', minWidth: 180 },
  { prop: 'type', label: '类型', width: 100, align: 'center' as const, slot: 'type' },
  { prop: 'amount', label: '金额', width: 120, align: 'right' as const, slot: 'amount' },
  { prop: 'signDate', label: '签订日期', width: 120 },
  { prop: 'expireDate', label: '到期日期', minWidth: 200, slot: 'expireDate' },
  { prop: 'fileName', label: '附件', minWidth: 150, slot: 'fileName' },
  { prop: 'remark', label: '备注', minWidth: 120 },
]

// 筛选
const filterType = ref('')
const filterStatus = ref('')
const filterKeyword = ref('')

const filteredContracts = computed(() => {
  return contractList.value.filter(c => {
    if (filterType.value && c.type !== filterType.value) return false
    if (filterStatus.value && getContractStatus(c.expireDate) !== filterStatus.value) return false
    if (filterKeyword.value) {
      const kw = filterKeyword.value.toLowerCase()
      if (!c.title.toLowerCase().includes(kw) && !c.supplierName.toLowerCase().includes(kw)) return false
    }
    return true
  })
})

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formRef = ref()

const formData = reactive({
  id: 0,
  title: '',
  supplierName: '',
  type: '',
  amount: 0,
  signDate: '',
  expireDate: '',
  fileName: '',
  filePath: '',
  remark: '',
})

const rules = {
  title: [{ required: true, message: '请输入合同标题', trigger: 'blur' }],
  supplierName: [{ required: true, message: '请选择或输入客户名称', trigger: 'change' }],
  type: [{ required: true, message: '请选择合同类型', trigger: 'change' }],
  amount: [{ required: true, message: '请输入合同金额', trigger: 'blur' }],
  signDate: [{ required: true, message: '请选择签订日期', trigger: 'change' }],
  expireDate: [{ required: true, message: '请选择到期日期', trigger: 'change' }],
}

function handleAdd() {
  dialogTitle.value = '新增合同'
  Object.assign(formData, {
    id: 0, title: '', supplierName: '', type: '', amount: 0,
    signDate: '', expireDate: '', fileName: '', filePath: '', remark: '',
  })
  dialogVisible.value = true
}

function handleEdit(row: Contract) {
  dialogTitle.value = '编辑合同'
  Object.assign(formData, row)
  dialogVisible.value = true
}

function onFileChange(files: any[]) {
  if (files.length > 0) {
    formData.fileName = files[0].name
  }
}

async function handleSave() {
  await formRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (formData.id === 0) {
        await addContract({
          title: formData.title,
          supplierName: formData.supplierName,
          type: formData.type,
          amount: formData.amount,
          signDate: formData.signDate,
          expireDate: formData.expireDate,
          fileName: formData.fileName,
          filePath: '',
          remark: formData.remark,
        })
        ElMessage.success('新增成功')
      } else {
        await updateContract(formData.id, { ...formData })
        ElMessage.success('编辑成功')
      }
      dialogVisible.value = false
    } catch {
      // 错误已由 composable 处理
    } finally {
      saving.value = false
    }
  })
}

function handleDelete(row: Contract) {
  ElMessageBox.confirm(`确定要删除"${row.title}"吗？`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    await deleteContract(row.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

async function handleBatchDelete(rows: Contract[]) {
  for (const row of rows) {
    await deleteContract(row.id)
  }
  ElMessage.success(`已删除 ${rows.length} 项`)
}

function handleViewFile(row: Contract) {
  if (row.filePath) {
    window.open(row.filePath, '_blank')
  } else {
    ElMessage.info(`查看合同附件：${row.fileName}`)
  }
}
</script>

<style scoped>
.amount-text {
  font-weight: 600;
  color: var(--color-primary);
}

.expire-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.expire-date {
  flex-shrink: 0;
}

.text-placeholder {
  color: var(--text-placeholder);
  font-size: var(--font-size-small);
}

.upload-area {
  width: 100%;
}

.current-file {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-page);
  border-radius: var(--radius-btn);
  border: 1px solid var(--border-lighter);
}

.current-file .file-name {
  flex: 1;
  font-size: var(--font-size-body);
  color: var(--text-primary);
}
</style>
