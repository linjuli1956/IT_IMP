<template>
  <div class="page-container">
    <PageHeader title="支付管理">
      <template #actions>
        <el-button type="primary" @click="handleAddConfig">
          <el-icon><Plus /></el-icon>
          新增配置
        </el-button>
      </template>
    </PageHeader>

    <el-alert type="info" :closable="false" show-icon class="usage-alert">
      <template #title>使用说明</template>
      <div class="usage-tips">
        <p>1. 支付配置：管理各门店支付方式的商户号、密钥、APPID等配置项，支持自定义支付方式与服务商</p>
        <p>2. 敏感信息（密钥、退款密码）默认脱敏显示，点击眼睛图标可切换显示/隐藏</p>
        <p>3. 服务商行底色：中国邮政=浅蓝、昂捷=浅橙、昂捷离线付=浅绿，便于按服务商浏览</p>
        <p>4. 每列列头可筛选，勾选多行后可批量复制（Tab分隔，可粘贴Excel）</p>
      </div>
    </el-alert>

    <!-- 概览卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <StatCard :icon="Shop" :color="vars.primary" :bg="vars.primaryLight" :value="storeCount" label="门店数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="Setting" :color="vars.success" :bg="vars.successLight" :value="configItems.length" label="配置项总数" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleCheck" :color="vars.info" :bg="vars.infoLight" :value="activeCount" label="正常" />
      </el-col>
      <el-col :span="6">
        <StatCard :icon="CircleClose" :color="vars.danger" :bg="vars.dangerLight" :value="inactiveCount" label="停用" />
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <div class="card filter-bar">
      <el-input v-model="configFilterKeyword" placeholder="搜索机构代码/门店/服务商/配置项/配置值" clearable style="width: 360px" />
    </div>

    <!-- 配置表格 -->
    <div class="card" v-loading="loading">
      <CrudTable
        :columns="configColumns"
        :data="filteredConfigItems"
        :stripe="false"
        :row-class-name="getConfigRowClass"
        :show-batch-copy="true"
        @edit="handleEditConfig"
        @delete="handleDeleteConfig"
        @batch-delete="handleBatchDeleteConfig"
        @batch-copy="handleBatchCopy"
      >
        <template #payMethod="{ row }">
          <el-tag v-bind="getPayMethodTagAttrs(row.payMethod)" size="small">
            {{ payMethodMap[row.payMethod]?.name || row.payMethod }}
          </el-tag>
        </template>
        <template #configValue="{ row }">
          <div class="value-cell">
            <span class="value-text" :class="{ masked: row.isSensitive && !revealedIds.has(row.id) }">
              {{ row.isSensitive && !revealedIds.has(row.id) ? maskValue(row.configValue) : row.configValue }}
            </span>
            <el-icon v-if="row.isSensitive" class="toggle-icon" @click="toggleReveal(row.id)">
              <View v-if="!revealedIds.has(row.id)" />
              <Hide v-else />
            </el-icon>
            <el-icon v-else class="lock-icon"><Lock /></el-icon>
          </div>
        </template>
        <template #status="{ row }">
          <el-tag :type="row.status === '正常' ? 'success' : 'danger'" size="small">{{ row.status }}</el-tag>
        </template>
        <template #isSensitive="{ row }">
          <el-tag :type="row.isSensitive ? 'warning' : 'info'" size="small" effect="plain">
            {{ row.isSensitive ? '敏感' : '普通' }}
          </el-tag>
        </template>
      </CrudTable>
    </div>

    <!-- 配置项编辑弹窗 -->
    <el-dialog v-model="configDialogVisible" :title="configDialogTitle" width="680px" destroy-on-close>
      <el-form :model="configForm" label-width="120px" :rules="configRules" ref="configFormRef">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="门店" prop="storeName">
              <el-select v-model="configForm.storeName" placeholder="选择门店" filterable style="width: 100%" @change="onStoreChange">
                <el-option v-for="s in storeList" :key="s.id" :label="s.name" :value="s.name" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="机构代码" prop="storeId">
              <el-input v-model="configForm.storeId" placeholder="选择门店后自动带出" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="支付方式" prop="payMethod">
              <el-select v-model="configForm.payMethod" placeholder="选择支付方式" style="width: 100%" filterable allow-create @change="onPayMethodChange">
                <el-option v-for="m in allPayMethodOptions" :key="m.value" :label="m.label" :value="m.value" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="服务商" prop="provider">
              <el-select v-model="configForm.provider" placeholder="选择服务商" style="width: 100%" filterable allow-create>
                <el-option v-for="p in providerOptions" :key="p" :label="p" :value="p" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="配置项名称" prop="configName">
              <el-input v-model="configForm.configName" placeholder="如：商户号/密钥/APPID" @input="onConfigNameChange" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="POS号" prop="posNo">
              <el-input v-model="configForm.posNo" placeholder="POS号（可选）" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="配置值" prop="configValue">
          <el-input
            v-model="configForm.configValue"
            :type="configForm.isSensitive ? 'password' : 'text'"
            :show-password="configForm.isSensitive"
            placeholder="请输入配置值"
          />
        </el-form-item>
        <el-form-item label="是否敏感">
          <el-switch v-model="configForm.isSensitive" />
          <span class="text-secondary" style="margin-left: 8px; font-size: var(--font-size-small);">
            密钥/秘钥/退款密码等敏感信息建议开启
          </span>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="configForm.status">
            <el-radio v-for="s in paymentStatusOptions" :key="s" :value="s">{{ s }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="configDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSaveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, View, Hide, Lock, Shop, Setting, CircleCheck, CircleClose,
} from '@element-plus/icons-vue'
import {
  usePaymentData, payMethodOptions, payMethodMap, providerOptions,
  isSensitiveField,
  type PaymentConfigItem,
} from '~/composables/usePaymentData'

const {
  configItems, loading, paymentStatusOptions,
  fetchConfigItems, addConfigItem, updateConfigItem, deleteConfigItem,
} = usePaymentData()

// 页面加载时获取支付配置
onMounted(() => {
  fetchConfigItems()
})

// 门店数据（从门店管理模块统一获取）
const { storeList } = useStoreData()

// —— CSS 变量颜色引用 ——
const vars = {
  primary: 'var(--color-primary)',
  primaryLight: 'var(--color-primary-light)',
  success: 'var(--color-success)',
  successLight: '#F0F9EB',
  info: 'var(--color-info)',
  infoLight: '#F4F4F5',
  danger: 'var(--color-danger)',
  dangerLight: '#FEF0F0',
}

// —— 概览统计 ——
const storeCount = computed(() => new Set(configItems.value.map(c => c.storeId)).size)
const activeCount = computed(() => configItems.value.filter(c => c.status === '正常').length)
const inactiveCount = computed(() => configItems.value.filter(c => c.status !== '正常').length)

// ==================== 支付配置 ====================

// —— 列头筛选选项（从数据动态生成）——
function uniqueFilters(prop: string) {
  return computed(() =>
    [...new Set(configItems.value.map((c: any) => c[prop]).filter(Boolean))]
      .map(v => ({ text: String(v), value: v }))
  )
}
const storeIdFilters = uniqueFilters('storeId')
const storeNameFilters = uniqueFilters('storeName')
const payMethodFilters = computed(() =>
  [...new Set(configItems.value.map(c => c.payMethod))]
    .map(v => ({ text: payMethodMap[v]?.name || v, value: v }))
)
const providerFilters = uniqueFilters('provider')
const configNameFilters = uniqueFilters('configName')
const isSensitiveFilters = [
  { text: '敏感', value: true },
  { text: '普通', value: false },
]
const statusFilters = [
  { text: '正常', value: '正常' },
  { text: '停用', value: '停用' },
]

function filterByProp(prop: string) {
  return (value: any, row: any) => row[prop] === value
}

const configColumns = computed(() => [
  { prop: 'storeId', label: '机构代码', width: 100, filters: storeIdFilters.value, filterMethod: filterByProp('storeId') },
  { prop: 'storeName', label: '门店', width: 120, filters: storeNameFilters.value, filterMethod: filterByProp('storeName') },
  { prop: 'payMethod', label: '支付方式', width: 100, align: 'center' as const, slot: 'payMethod', filters: payMethodFilters.value, filterMethod: filterByProp('payMethod') },
  { prop: 'provider', label: '服务商', width: 120, filters: providerFilters.value, filterMethod: filterByProp('provider') },
  { prop: 'configName', label: '配置项', width: 140, filters: configNameFilters.value, filterMethod: filterByProp('configName') },
  { prop: 'configValue', label: '配置值', minWidth: 220, slot: 'configValue' },
  { prop: 'isSensitive', label: '类型', width: 80, align: 'center' as const, slot: 'isSensitive', filters: isSensitiveFilters, filterMethod: filterByProp('isSensitive') },
  { prop: 'status', label: '状态', width: 80, align: 'center' as const, slot: 'status', filters: statusFilters, filterMethod: filterByProp('status') },
])

// —— 搜索 ——
const configFilterKeyword = ref('')

const filteredConfigItems = computed(() => {
  if (!configFilterKeyword.value) return configItems.value
  const kw = configFilterKeyword.value.toLowerCase()
  return configItems.value.filter(c => {
    const haystack = [c.storeId, c.storeName, c.provider, c.configName, c.configValue, c.posNo]
      .filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(kw)
  })
})

// 敏感值显示/隐藏
const revealedIds = ref<Set<number>>(new Set())

function toggleReveal(id: number) {
  if (revealedIds.value.has(id)) {
    revealedIds.value.delete(id)
  } else {
    revealedIds.value.add(id)
  }
  revealedIds.value = new Set(revealedIds.value)
}

function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••'
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4)
}

// 配置弹窗
const configDialogVisible = ref(false)
const configDialogTitle = ref('')
const configFormRef = ref()
const saving = ref(false)

const configForm = reactive<PaymentConfigItem>({
  id: 0, storeId: '', storeName: '', payMethod: '', payMethodName: '',
  provider: '', configName: '', configValue: '', posNo: '', status: '正常', isSensitive: false,
})

// —— 自定义支付方式配色 ——
const customColorPalette = ['#6C5CE7', '#00B894', '#0984E3', '#FD79A8', '#636E72', '#00CEC9']
const customPayMethodColors = ref<Record<string, string>>({})
const usedCustomColors = ref<Set<string>>(new Set())
const allPayMethodOptions = computed(() => {
  const presets = new Set(payMethodOptions.map(o => o.value))
  const extras = new Set<string>(Object.keys(customPayMethodColors.value))
  configItems.value.forEach(c => { if (!presets.has(c.payMethod)) extras.add(c.payMethod) })
  return [...payMethodOptions, ...[...extras].map(m => ({ value: m, label: m, tagType: '' }))]
})
const allProviderOptions = computed(() => {
  const fromData = configItems.value.map(c => c.provider).filter(Boolean)
  return [...new Set([...providerOptions, ...fromData])]
})
function getPayMethodTagAttrs(method: string): Record<string, any> {
  if (payMethodMap[method]) return { type: payMethodMap[method].tagType }
  if (customPayMethodColors.value[method]) return { color: customPayMethodColors.value[method], effect: 'light' }
  return { type: 'info' }
}

// —— 服务商行底色 ——
const providerBgMap: Record<string, string> = {
  '中国邮政': 'provider-postal',
  '昂捷': 'provider-angjie',
  '昂捷离线付': 'provider-angjie-offline',
}
function getConfigRowClass({ row }: { row: any }) {
  return providerBgMap[row.provider] || ''
}

const configRules = {
  storeId: [{ required: true, message: '请选择门店（自动带出机构代码）', trigger: 'blur' }],
  storeName: [{ required: true, message: '请选择门店', trigger: 'change' }],
  payMethod: [{ required: true, message: '请选择支付方式', trigger: 'change' }],
  provider: [{ required: true, message: '请选择服务商', trigger: 'change' }],
  configName: [{ required: true, message: '请输入配置项名称', trigger: 'blur' }],
  configValue: [{ required: true, message: '请输入配置值', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }],
}

function onStoreChange(storeName: string) {
  const store = storeList.value.find(s => s.name === storeName)
  if (store) {
    configForm.storeId = store.code || ''
  }
}

function onPayMethodChange(val: string) {
  configForm.payMethodName = payMethodMap[val]?.name || val
  if (!payMethodMap[val] && !customPayMethodColors.value[val]) {
    const available = customColorPalette.find(c => !usedCustomColors.value.has(c))
    if (available) {
      customPayMethodColors.value[val] = available
      usedCustomColors.value.add(available)
    }
  }
}

function onConfigNameChange() {
  configForm.isSensitive = isSensitiveField(configForm.configName)
}

function handleAddConfig() {
  configDialogTitle.value = '新增配置'
  Object.assign(configForm, {
    id: 0, storeId: '', storeName: '', payMethod: '', payMethodName: '',
    provider: '', configName: '', configValue: '', posNo: '', status: '正常', isSensitive: false,
  })
  configDialogVisible.value = true
}

function handleEditConfig(row: any) {
  const c = row as PaymentConfigItem
  configDialogTitle.value = '编辑配置'
  Object.assign(configForm, c)
  configDialogVisible.value = true
}

function handleSaveConfig() {
  configFormRef.value?.validate(async (valid: boolean) => {
    if (!valid) return
    saving.value = true
    try {
      if (configForm.id === 0) {
        await addConfigItem({
          storeId: configForm.storeId,
          storeName: configForm.storeName,
          payMethod: configForm.payMethod,
          payMethodName: configForm.payMethodName,
          provider: configForm.provider,
          configName: configForm.configName,
          configValue: configForm.configValue,
          posNo: configForm.posNo,
          status: configForm.status,
          isSensitive: configForm.isSensitive,
        })
        ElMessage.success('新增成功')
      } else {
        await updateConfigItem(configForm.id, { ...configForm })
        ElMessage.success('编辑成功')
      }
      configDialogVisible.value = false
    } catch {
      // 错误已由 composable 处理
    } finally {
      saving.value = false
    }
  })
}

function handleDeleteConfig(row: any) {
  const c = row as PaymentConfigItem
  ElMessageBox.confirm(`确定要删除配置"${c.configName}"吗？`, '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
  }).then(async () => {
    await deleteConfigItem(c.id)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

async function handleBatchDeleteConfig(rows: any[]) {
  const items = rows as PaymentConfigItem[]
  for (const item of items) {
    await deleteConfigItem(item.id)
  }
  ElMessage.success(`已删除 ${items.length} 项`)
}

// —— 批量复制（Tab分隔，可粘贴Excel）——
function handleBatchCopy(rows: any[]) {
  if (rows.length === 0) {
    ElMessage.warning('请先选择要复制的行')
    return
  }
  const headers = ['机构代码', '门店', '支付方式', '服务商', '配置项', '配置值', '类型', '状态']
  const lines = (rows as PaymentConfigItem[]).map(row => [
    row.storeId,
    row.storeName,
    payMethodMap[row.payMethod]?.name || row.payMethod,
    row.provider,
    row.configName,
    row.configValue,
    row.isSensitive ? '敏感' : '普通',
    row.status,
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
.value-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.value-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: var(--font-size-small);
}

.value-text.masked {
  color: var(--text-secondary);
  letter-spacing: 1px;
}

.toggle-icon {
  cursor: pointer;
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: color 0.2s;
}

.toggle-icon:hover {
  color: var(--color-primary);
}

.lock-icon {
  color: var(--text-placeholder);
  flex-shrink: 0;
  font-size: var(--font-size-body);
}

/* 服务商行底色 */
:deep(.provider-postal > td) { background: var(--provider-postal-bg) !important; }
:deep(.provider-angjie > td) { background: var(--provider-angjie-bg) !important; }
:deep(.provider-angjie-offline > td) { background: var(--provider-angjie-offline-bg) !important; }
:deep(.provider-postal:hover > td) { background: var(--provider-postal-hover) !important; }
:deep(.provider-angjie:hover > td) { background: var(--provider-angjie-hover) !important; }
:deep(.provider-angjie-offline:hover > td) { background: var(--provider-angjie-offline-hover) !important; }
</style>
