<template>
  <div class="page-container">
    <PageHeader
      title="计提模板管理"
      subtitle="运营商+门店计提规则配置"
      :description="`每个运营商+门店一套模板，点击「编辑明细」配置模板行。电信模板填号码匹配明细表，联通/移动填费用类型直接填发票金额。报销说明支持 4 种预设格式或自定义。`"
    >
      <template #actions>
        <el-button v-if="canEdit" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增模板
        </el-button>
      </template>
    </PageHeader>

    <div class="card filter-bar">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索运营商或门店"
        clearable
        :prefix-icon="Search"
        style="width: 260px"
      />
    </div>

    <div class="card">
      <CrudTable
        v-if="filteredTemplateList.length > 0 || loading"
        :columns="columns"
        :data="filteredTemplateList"
        :loading="loading"
        :show-selection="canEdit"
        :show-actions="canEdit"
        :action-width="180"
        @delete="handleDelete"
        @batch-delete="handleBatchDelete"
      >
        <template #store="{ row }">
          {{ getInvolvedDepts(row) }}
        </template>
        <template #itemCount="{ row }">
          <el-tag size="small" type="info">{{ row.itemCount }} 行</el-tag>
        </template>
        <template #actions="{ row }">
          <el-button size="small" text type="primary" @click="handleEditDetail(row)">编辑明细</el-button>
          <el-button size="small" text @click="handleViewDetail(row)">查看</el-button>
          <el-button size="small" text type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </CrudTable>
      <EmptyState v-else description="暂无计提模板" />
    </div>

    <!-- 新增模板弹窗 -->
    <EditDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :fields="fields"
      :form-data="formData"
      :rules="rules"
      :saving="saving"
      @save="handleSave"
    />

    <!-- 模板明细编辑弹窗 -->
    <el-dialog v-model="detailVisible" :title="detailReadonly ? '查看模板明细' : '编辑模板明细'" width="960px" @close="detailVisible = false">
      <div class="detail-header">
        <el-tag size="default">{{ currentTemplate.carrier }}</el-tag>
        <span class="detail-store">{{ currentTemplate.store }}</span>
        <el-tooltip content="电信模板'名称'列写号码用于匹配明细表；联通/移动写费用类型直接填发票金额" placement="top">
          <el-icon class="tip-icon"><InfoFilled /></el-icon>
        </el-tooltip>
      </div>

      <el-table :data="detailRows" border style="width: 100%" size="small">
        <el-table-column label="序号" width="60" align="center">
          <template #default="{ $index }">{{ $index + 1 }}</template>
        </el-table-column>
        <el-table-column label="承担部门" width="220">
          <template #default="{ row }">
            <el-select v-model="row.dept" size="small" placeholder="选择部门" :disabled="detailReadonly" filterable multiple style="width: 100%">
              <el-option v-for="opt in storeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="名称/号码" min-width="180">
          <template #default="{ row }">
              <el-input v-model="row.name" size="small" :placeholder="currentTemplate.carrier === '中国电信' ? '填号码(如 DEMO_PHONE)' : '填费用类型(如宽带固话)'" :disabled="detailReadonly" />
          </template>
        </el-table-column>
        <el-table-column label="单位" width="90">
          <template #default="{ row }">
            <el-input v-model="row.unit" size="small" placeholder="条/部/个" :disabled="detailReadonly" />
          </template>
        </el-table-column>
        <el-table-column label="预设费用" width="130">
          <template #default="{ row }">
            <el-input-number v-model="row.amount" size="small" :min="0" :precision="2" controls-position="right" :disabled="detailReadonly" style="width: 100%" />
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.remark" size="small" placeholder="备注" :disabled="detailReadonly" />
          </template>
        </el-table-column>
        <el-table-column v-if="!detailReadonly" label="操作" width="70" align="center">
          <template #default="{ $index }">
            <el-button size="small" type="danger" link @click="removeRow($index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="!detailReadonly" class="add-row-bar">
        <el-button @click="addRow" plain>
          <el-icon><Plus /></el-icon>
          添加行
        </el-button>
      </div>

      <!-- 报销说明配置 -->
      <el-divider content-position="left">报销说明配置</el-divider>
      <el-form label-width="100px" :disabled="detailReadonly">
        <el-form-item label="预设格式">
          <el-select v-model="currentTemplate.reimbursementFormat" placeholder="选择预设格式" clearable style="width: 100%">
            <el-option label="分摊明细型（按部门分行显示分摊金额）" value="分摊明细型" />
            <el-option label="汇总简明型（门店+月+运营商+费用+金额）" value="汇总简明型" />
            <el-option label="年费描述型（年费场景描述）" value="年费描述型" />
            <el-option label="分项列举型（按费用项逐项列举）" value="分项列举型" />
            <el-option label="自定义" value="自定义" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="currentTemplate.reimbursementFormat === '自定义'" label="自定义格式">
          <el-input v-model="currentTemplate.reimbursementCustom" type="textarea" :rows="3" placeholder="使用变量占位符，如：{门店}{年月}{运营商}费用：{金额} 元" />
          <div class="var-hint">
            可用变量：{门店} {年月} {运营商} {费用类型} {金额} {部门} {号码数}
          </div>
        </el-form-item>
        <el-form-item v-if="currentTemplate.reimbursementFormat" label=" ">
          <el-button @click="showPreview = !showPreview">
            <el-icon><View /></el-icon>
            {{ showPreview ? '收起预览' : '预览效果' }}
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 预览区域 -->
      <div v-if="showPreview && currentTemplate.reimbursementFormat" class="preview-box">
        <div class="preview-title">报销说明预览（使用模拟数据）</div>
        <div class="preview-content">{{ previewText }}</div>
      </div>

      <template #footer>
        <el-button @click="detailVisible = false">{{ detailReadonly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!detailReadonly" type="primary" @click="saveDetail">保存明细</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, InfoFilled, View, Search } from '@element-plus/icons-vue'
import { generateReimbursementText } from '~/utils/reimbursement'

// 运营商选项
const carrierOptions = [
  { label: '中国电信', value: '中国电信' },
  { label: '中国联通', value: '中国联通' },
  { label: '中国移动', value: '中国移动' },
  { label: '广西广电', value: '广西广电' },
]

// 从共享数据源获取门店选项（与门店管理页面共用同一份数据）
const { storeOptions } = useStoreData()

// 从共享数据源获取计提模板（计提管理模块也使用同一份数据）
const { templateList, loading, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, getInvolvedDepts } = useTemplateData()

const canEdit = ref(false)
const searchKeyword = ref('')

const filteredTemplateList = computed(() => {
  if (!searchKeyword.value) return templateList.value
  const kw = searchKeyword.value.toLowerCase()
  return templateList.value.filter((t: any) =>
    (t.carrier || '').toLowerCase().includes(kw) ||
    (t.store || '').toLowerCase().includes(kw)
  )
})

// 页面加载时获取模板列表
onMounted(() => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      const role = JSON.parse(rawUser).role
      canEdit.value = role === '管理员' || role === '操作员'
    } catch { canEdit.value = false }
  }
  fetchTemplates()
})

// 列配置
const columns = [
  { prop: 'carrier', label: '运营商', width: 120 },
  { prop: 'store', label: '门店/机构', minWidth: 200, slot: 'store' },
  { prop: 'itemCount', label: '明细行数', width: 100, align: 'center' as const, slot: 'itemCount' },
  { prop: 'updateTime', label: '更新时间', width: 140, align: 'center' as const },
]

// 表单字段配置（computed 保证门店选项响应式更新）
const fields = computed(() => [
  { prop: 'carrier', label: '运营商', type: 'select' as const, placeholder: '请选择运营商', options: carrierOptions },
  { prop: 'store', label: '门店/机构', type: 'select' as const, placeholder: '请选择门店或机构', options: storeOptions.value },
])

// 验证规则
const rules = {
  carrier: [{ required: true, message: '请选择运营商', trigger: 'change' }],
  store: [{ required: true, message: '请选择门店/机构', trigger: 'change' }],
}

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const saving = ref(false)
const formData = reactive({
  id: 0,
  carrier: '',
  store: '',
})

// 明细编辑状态
const detailVisible = ref(false)
const detailReadonly = ref(false)
const currentTemplate = reactive({ id: 0, carrier: '', store: '', reimbursementFormat: '', reimbursementCustom: '' })
const detailRows = ref<any[]>([])

// 预览状态
const showPreview = ref(false)

// 预览文本（调用共享报销说明生成器，与真实计提生成保持一致，含单位解析）
const previewText = computed(() => {
  if (!currentTemplate.reimbursementFormat) return '请选择预设格式或自定义格式'
  const store = currentTemplate.store || '总部信息部'
  const carrier = currentTemplate.carrier || '中国电信'
  const rows = detailRows.value.map((row: any) => ({
    dept: Array.isArray(row.dept) ? row.dept : (row.dept ? [row.dept] : []),
    name: row.name || '',
    amount: Number(row.amount) || 0,
    feeType: '',
    unit: row.unit || '',
  }))
  return generateReimbursementText(
    currentTemplate.reimbursementFormat,
    currentTemplate.reimbursementCustom || '',
    rows,
    store,
    '2026-07',
    carrier,
  )
})

function handleAdd() {
  dialogTitle.value = '新增模板'
  formData.id = 0
  formData.carrier = ''
  formData.store = ''
  dialogVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const result = await createTemplate({ carrier: formData.carrier, store: formData.store })
    if (!result) {
      // 错误消息已由 createTemplate 显示
      return
    }
    ElMessage.success('新增成功，请点击"编辑明细"添加模板行')
    dialogVisible.value = false
  } finally {
    saving.value = false
  }
}

function handleEditDetail(row: any) {
  detailReadonly.value = false
  currentTemplate.id = row.id
  currentTemplate.carrier = row.carrier
  currentTemplate.store = row.store
  currentTemplate.reimbursementFormat = row.reimbursementFormat || ''
  currentTemplate.reimbursementCustom = row.reimbursementCustom || ''
  detailRows.value = row.items.map((item: any) => ({ ...item, dept: Array.isArray(item.dept) ? [...item.dept] : [item.dept] }))
  detailVisible.value = true
}

function handleViewDetail(row: any) {
  detailReadonly.value = true
  currentTemplate.id = row.id
  currentTemplate.carrier = row.carrier
  currentTemplate.store = row.store
  currentTemplate.reimbursementFormat = row.reimbursementFormat || ''
  currentTemplate.reimbursementCustom = row.reimbursementCustom || ''
  detailRows.value = row.items.map((item: any) => ({ ...item, dept: Array.isArray(item.dept) ? [...item.dept] : [item.dept] }))
  detailVisible.value = true
}

function addRow() {
  detailRows.value.push({
    dept: [currentTemplate.store],
    name: '',
    amount: 0,
    remark: '',
    unit: '',
  })
}

function removeRow(index: number) {
  detailRows.value.splice(index, 1)
}

async function saveDetail() {
  if (detailRows.value.length === 0) {
    ElMessage.warning('请至少添加一行明细')
    return
  }
  const success = await updateTemplate(currentTemplate.id, {
    items: detailRows.value.map(item => ({ ...item, dept: [...item.dept] })),
    reimbursementFormat: currentTemplate.reimbursementFormat,
    reimbursementCustom: currentTemplate.reimbursementCustom,
  })
  if (success) {
    ElMessage.success('明细保存成功')
    detailVisible.value = false
  }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(`确定要删除"${row.carrier} - ${row.store}"的模板吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const success = await deleteTemplate(row.id)
    if (success) {
      ElMessage.success('删除成功')
    }
  } catch {
    // 用户取消
  }
}

async function handleBatchDelete(rows: any[]) {
  let successCount = 0
  for (const r of rows) {
    const ok = await deleteTemplate(r.id)
    if (ok) successCount++
  }
  if (successCount > 0) {
    ElMessage.success(`已删除 ${successCount} 项`)
  }
}

</script>

<style scoped>
.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--color-primary-light);
  border-radius: var(--radius-input);
}

.detail-store {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.tip-icon {
  color: var(--text-secondary);
  cursor: help;
  font-size: 16px;
}

.add-row-bar {
  margin-top: 12px;
}

.var-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.preview-box {
  margin-top: 12px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-radius: var(--radius-input);
  border: 1px dashed var(--border-color);
}

.preview-title {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.preview-content {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.8;
  white-space: pre-wrap;
}
</style>
