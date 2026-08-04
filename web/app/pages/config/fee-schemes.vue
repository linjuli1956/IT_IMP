<template>
  <div class="page-container">
    <PageHeader title="费用分摊方案管理">
      <template #actions>
        <el-button type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增方案
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>费用分摊方案 — 通用费用分摊规则引擎</template>
      <div class="usage-tips">
        <p>• 方案独立于运营商和门店，支持跨门店、按费用类型分行展示的分摊方式</p>
        <p>• 四种分摊方式：固定金额、比例、按数量、手动输入</p>
        <p>• 生成计提表时选择"按费用分摊方案"模式即可使用</p>
        <p>• 运营商为空表示通用方案，所有运营商均可使用</p>
      </div>
    </el-alert>

    <CrudTable
      :columns="columns"
      :data="schemeList"
      :loading="loading"
      :show-selection="false"
      @delete="handleDelete"
    >
      <template #carrier="{ row }">
        <el-tag v-if="row.carrier" size="small" :type="carrierTagType(row.carrier)">{{ row.carrier }}</el-tag>
        <el-tag v-else size="small" type="info">通用</el-tag>
      </template>
      <template #itemCount="{ row }">
        {{ row.items?.length || 0 }} 个费用项
      </template>
      <template #status="{ row }">
        <el-tag :type="row.status === 1 ? 'success' : 'danger'" size="small">
          {{ row.status === 1 ? '启用' : '禁用' }}
        </el-tag>
      </template>
      <template #actions="{ row }">
        <el-button size="small" link type="primary" @click="handleEdit(row)">编辑</el-button>
        <el-button size="small" link type="info" @click="handleView(row)">查看</el-button>
        <el-button size="small" link type="warning" @click="handleToggleStatus(row)">
          {{ row.status === 1 ? '禁用' : '启用' }}
        </el-button>
      </template>
    </CrudTable>

    <!-- 方案编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="1000px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" :disabled="readonly">
        <el-form-item label="方案名称" required>
          <el-input v-model="formData.name" placeholder="如：联通宽带套餐分摊" style="width: 300px" />
        </el-form-item>
        <el-form-item label="运营商">
          <el-select v-model="formData.carrier" placeholder="选择运营商（空=通用）" clearable style="width: 200px">
            <el-option v-for="c in carrierOptions" :key="c.value" :label="c.label" :value="c.value" />
            <el-option label="通用（不绑定运营商）" value="" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">费用项配置</el-divider>
      <FeeItemEditor v-if="dialogVisible" v-model="formData.items" />

      <el-divider content-position="left">报销说明配置</el-divider>
      <el-form label-width="100px" :disabled="readonly">
        <el-form-item label="预设格式">
          <el-select v-model="formData.reimbursementFormat" placeholder="选择预设格式" clearable style="width: 100%">
            <el-option label="分摊明细型（按费用类型组织分摊描述）" value="分摊明细型" />
            <el-option label="汇总简明型（门店+月+运营商+费用类型+金额）" value="汇总简明型" />
            <el-option label="年费描述型（年费场景描述）" value="年费描述型" />
            <el-option label="分项列举型（按费用项逐项列举）" value="分项列举型" />
            <el-option label="自定义" value="自定义" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="formData.reimbursementFormat === '自定义'" label="自定义格式">
          <el-input v-model="formData.reimbursementCustom" type="textarea" :rows="3" placeholder="使用变量占位符，如：{门店}{年月}{运营商}费用：{金额} 元" />
          <div class="var-hint">
            可用变量：{门店} {年月} {运营商} {费用类型} {金额} {部门}
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">{{ readonly ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!readonly" type="primary" :loading="saving" @click="handleSave">保存方案</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import type { FeeItem, FeeAllocationScheme } from '~/types/fee-scheme'

const carrierOptions = [
  { label: '中国电信', value: '中国电信' },
  { label: '中国联通', value: '中国联通' },
  { label: '中国移动', value: '中国移动' },
  { label: '广西广电', value: '广西广电' },
]

const { schemeList, loading, fetchFeeSchemes, createFeeScheme, updateFeeScheme, deleteFeeScheme } = useFeeSchemeData()

onMounted(() => {
  fetchFeeSchemes()
})

const columns = [
  { prop: 'name', label: '方案名称', minWidth: 200 },
  { prop: 'carrier', label: '运营商', width: 120, slot: 'carrier' },
  { prop: 'itemCount', label: '费用项数', width: 120, align: 'center' as const, slot: 'itemCount' },
  { prop: 'status', label: '状态', width: 100, align: 'center' as const, slot: 'status' },
  { prop: 'updateTime', label: '更新时间', width: 160, align: 'center' as const },
]

function carrierTagType(carrier: string): 'primary' | 'success' | 'warning' | 'info' {
  const map: Record<string, 'primary' | 'success' | 'warning' | 'info'> = {
    '中国电信': 'primary',
    '中国联通': 'success',
    '中国移动': 'warning',
    '广西广电': 'info',
  }
  return map[carrier] || 'info'
}

// 弹窗状态
const dialogVisible = ref(false)
const dialogTitle = ref('')
const readonly = ref(false)
const saving = ref(false)
const formData = reactive({
  id: 0,
  name: '',
  carrier: '',
  items: [] as FeeItem[],
  reimbursementFormat: '分摊明细型',
  reimbursementCustom: '',
})

function handleAdd() {
  dialogTitle.value = '新增费用分摊方案'
  readonly.value = false
  formData.id = 0
  formData.name = ''
  formData.carrier = ''
  formData.items = []
  formData.reimbursementFormat = '分摊明细型'
  formData.reimbursementCustom = ''
  dialogVisible.value = true
}

function handleEdit(row: FeeAllocationScheme) {
  dialogTitle.value = '编辑费用分摊方案'
  readonly.value = false
  formData.id = row.id
  formData.name = row.name
  formData.carrier = row.carrier
  formData.items = (row.items || []).map((item: any) => ({ ...item, allocations: (item.allocations || []).map((a: any) => ({ ...a, dept: [...a.dept] })) }))
  formData.reimbursementFormat = row.reimbursementFormat || '分摊明细型'
  formData.reimbursementCustom = row.reimbursementCustom || ''
  dialogVisible.value = true
}

function handleView(row: FeeAllocationScheme) {
  dialogTitle.value = '查看费用分摊方案'
  readonly.value = true
  formData.id = row.id
  formData.name = row.name
  formData.carrier = row.carrier
  formData.items = (row.items || []).map((item: any) => ({ ...item, allocations: (item.allocations || []).map((a: any) => ({ ...a, dept: [...a.dept] })) }))
  formData.reimbursementFormat = row.reimbursementFormat || '分摊明细型'
  formData.reimbursementCustom = row.reimbursementCustom || ''
  dialogVisible.value = true
}

async function handleSave() {
  if (!formData.name) {
    ElMessage.warning('请填写方案名称')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: formData.name,
      carrier: formData.carrier,
      items: formData.items,
      reimbursementFormat: formData.reimbursementFormat,
      reimbursementCustom: formData.reimbursementCustom,
    }
    if (formData.id === 0) {
      const result = await createFeeScheme(payload)
      if (result) {
        ElMessage.success('新增成功')
        dialogVisible.value = false
      }
    } else {
      const success = await updateFeeScheme(formData.id, payload)
      if (success) {
        ElMessage.success('保存成功')
        dialogVisible.value = false
      }
    }
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FeeAllocationScheme) {
  try {
    await ElMessageBox.confirm(`确定要删除方案"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    const success = await deleteFeeScheme(row.id)
    if (success) {
      ElMessage.success('删除成功')
    }
  } catch {
    // 用户取消
  }
}

async function handleToggleStatus(row: FeeAllocationScheme) {
  const newStatus = row.status === 1 ? 0 : 1
  const success = await updateFeeScheme(row.id, { status: newStatus })
  if (success) {
    ElMessage.success(newStatus === 1 ? '已启用' : '已禁用')
  }
}
</script>

<style scoped>
.usage-alert {
  margin-bottom: var(--spacing-card);
}

.usage-tips p {
  margin: 4px 0;
  line-height: 1.6;
}

.var-hint {
  font-size: var(--font-size-mini);
  color: var(--text-secondary);
  margin-top: 4px;
}
</style>
