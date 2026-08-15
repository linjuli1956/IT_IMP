<template>
  <div class="page-container">
    <PageHeader
      title="系统设置"
      subtitle="财年与系统参数配置"
      :description="`财年起始月决定预算模块的财年划分（如设为 4，则 4 月~次年 3 月为一个财年）。修改保存后立即生效，仅管理员可保存修改。`"
    />

    <div class="card">
      <div class="section-title">财年配置</div>
      <el-form label-width="120px" class="settings-form">
        <el-form-item label="财年起始月">
          <div class="setting-field">
            <el-select v-model="startMonth" style="width: 200px" :disabled="!isAdmin">
              <el-option v-for="m in 12" :key="m" :label="m + '月'" :value="m" />
            </el-select>
            <div class="form-tip">当前财年规则：{{ yearRangeText }}</div>
          </div>
        </el-form-item>
        <el-form-item v-if="isAdmin" label=" ">
          <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useSettingsData } from '~/composables/useSettingsData'

const { settings, fiscalYearStartMonth, saveSettings } = useSettingsData()

const isAdmin = ref(false)
const startMonth = ref(4)
const saving = ref(false)

// 从设置同步起始月（设置未加载前保持默认 4）
watch(
  () => settings.value.startMonth,
  (value) => {
    if (value !== undefined && value !== null && value !== '') {
      const n = Number(value)
      if (Number.isInteger(n) && n >= 1 && n <= 12) startMonth.value = n
    }
  },
  { immediate: true },
)

// 财年规则示例文案（用当前年展示）
const yearRangeText = computed(() => {
  const y = 2026
  const m = fiscalYearStartMonth.value
  const endMonth = m === 1 ? 12 : m - 1
  const endYear = m === 1 ? y : y + 1
  return `${y}年${m}月 ~ ${endYear}年${endMonth}月 为一个财年`
})

onMounted(() => {
  const rawUser = localStorage.getItem('user_info')
  if (rawUser) {
    try {
      isAdmin.value = JSON.parse(rawUser).role === '管理员'
    } catch {
      isAdmin.value = false
    }
  }
})

async function handleSave() {
  saving.value = true
  try {
    const ok = await saveSettings({ startMonth: startMonth.value })
    if (ok) {
      ElMessage.success(`财年起始月已更新为 ${startMonth.value} 月`)
    }
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.settings-form { max-width: 560px; margin-top: var(--spacing-card); }
.setting-field { display: flex; flex-direction: column; gap: 6px; }
.form-tip { font-size: var(--font-size-mini); color: var(--text-secondary); }
</style>
