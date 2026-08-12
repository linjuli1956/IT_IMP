<!--
  服务器凭据弹窗（公共组件）
  - 默认进入设置/更新模式，不自动调用 view API
  - 显式"查看已保存凭据"才调用 view
  - "清除已保存凭据"需二次确认
  - 空输入保存不误当清除
  - Footer: 关闭 + 更多(查看/清除) + 保存
-->
<template>
  <el-dialog v-model="visible" title="服务器凭据" width="520px" destroy-on-close>
    <el-form :model="form" label-width="110px">
      <el-form-item label="登录账号">
        <span class="credential-account">{{ account || '—' }}</span>
      </el-form-item>
      <el-form-item label="数据库账号">
        <span class="credential-account">{{ dbAccount || '—' }}</span>
      </el-form-item>
      <el-form-item label="登录密码">
        <el-input v-model="form.password" type="password" show-password placeholder="可选填写。留空表示不修改" />
      </el-form-item>
      <el-form-item label="数据库密码">
        <el-input v-model="form.dbPassword" type="password" show-password placeholder="可选填写。留空表示不修改" />
      </el-form-item>
      <el-alert type="info" :closable="false" show-icon>
        <template #title>可选填写。留空表示不保存或不修改现有凭据。内网可选保存的服务器凭据。</template>
      </el-alert>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-dropdown trigger="click" @command="handleMore">
        <el-button>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="view" :disabled="viewing">
              <el-icon><View /></el-icon>查看已保存凭据
            </el-dropdown-item>
            <el-dropdown-item command="clear" divided>
              <el-icon><Delete /></el-icon>清除已保存凭据
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, View, Delete } from '@element-plus/icons-vue'
import { useServerData } from '~/composables/useServerData'
import { getApiErrorMessage } from '~/composables/useApi'

const props = defineProps<{
  modelValue: boolean
  serverId: number | null
  serverName: string
  account?: string
  dbAccount?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  saved: []
  cleared: []
}>()

const { fetchServerPassword, updateServerPassword } = useServerData()

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const form = reactive({ password: '', dbPassword: '' })
const saving = ref(false)
const viewing = ref(false)

// 弹窗打开时重置表单
watch(() => props.modelValue, (v) => {
  if (v) {
    form.password = ''
    form.dbPassword = ''
  }
})

async function handleView() {
  if (!props.serverId) return
  viewing.value = true
  try {
    const data = await fetchServerPassword(props.serverId)
    form.password = data.password
    form.dbPassword = data.dbPassword
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    viewing.value = false
  }
}

async function handleSave() {
  if (!props.serverId) return
  if (!form.password && !form.dbPassword) {
    ElMessage.info('两个密码字段均为空，未做修改。如需清除请使用"清除已保存凭据"')
    return
  }
  saving.value = true
  try {
    await updateServerPassword(props.serverId, {
      ...(form.password ? { password: form.password } : {}),
      ...(form.dbPassword ? { dbPassword: form.dbPassword } : {}),
    })
    ElMessage.success('凭据已保存')
    emit('saved')
    visible.value = false
  } catch (error) {
    ElMessage.error(getApiErrorMessage(error))
  } finally {
    saving.value = false
  }
}

async function handleClear() {
  if (!props.serverId) return
  try {
    await ElMessageBox.confirm(
      `确定要清除服务器「${props.serverName}」的所有已保存凭据吗？此操作不可撤销。`,
      '清除凭据确认',
      {
        confirmButtonText: '确定清除',
        cancelButtonText: '取消',
        type: 'warning',
        confirmButtonClass: 'btn-danger-confirm',
        customClass: 'credential-clear-confirm',
      },
    )
    await updateServerPassword(props.serverId, { password: '', dbPassword: '' })
    ElMessage.success('已清除所有凭据')
    form.password = ''
    form.dbPassword = ''
    emit('cleared')
  } catch (error) {
    if (error !== 'cancel') ElMessage.error(getApiErrorMessage(error))
  }
}

function handleMore(cmd: string) {
  if (cmd === 'view') handleView()
  else if (cmd === 'clear') handleClear()
}
</script>

<style scoped>
.credential-account {
  font-family: var(--font-family-mono, monospace);
  color: var(--text-primary);
}
</style>
