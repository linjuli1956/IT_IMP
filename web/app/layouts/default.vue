<template>
  <el-container class="layout-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
      <div class="logo">
        <el-icon size="24" color="var(--color-primary)"><Coin /></el-icon>
        <span v-if="!isCollapse">{{ appName }}</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapse"
        :collapse-transition="false"
        router
        class="layout-menu"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>

        <el-sub-menu index="expense">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>费用报销</span>
          </template>
          <el-menu-item index="/invoices/upload">上传发票</el-menu-item>
          <el-menu-item index="/invoices/batches">批次列表</el-menu-item>
          <el-menu-item index="/invoices/list">发票列表</el-menu-item>
          <el-menu-item index="/details">明细表管理</el-menu-item>
          <el-menu-item index="/accruals">计提表列表</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="config">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>基础配置</span>
          </template>
          <el-menu-item index="/config/stores">部门门店机构</el-menu-item>
          <el-menu-item index="/config/templates">计提模板</el-menu-item>
          <el-menu-item index="/config/fee-schemes">费用分摊方案</el-menu-item>
          <el-menu-item index="/config/suppliers">客户管理</el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/contracts">
          <el-icon><Files /></el-icon>
          <span>合同管理</span>
        </el-menu-item>

        <el-menu-item index="/budget">
          <el-icon><Wallet /></el-icon>
          <span>预算管理</span>
        </el-menu-item>

        <el-menu-item index="/payment">
          <el-icon><CreditCard /></el-icon>
          <span>支付管理</span>
        </el-menu-item>

        <el-sub-menu index="it">
          <template #title>
            <el-icon><Monitor /></el-icon>
            <span>IT资产管理</span>
          </template>
          <el-menu-item index="/it/servers">服务器管理</el-menu-item>
          <el-menu-item index="/it/domains">域名管理</el-menu-item>
          <el-menu-item index="/it/miniapps">小程序管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="system">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/system/users">用户管理</el-menu-item>
          <el-menu-item index="/system/logs">操作日志</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 右侧主体 -->
    <el-container class="layout-main">
      <!-- 顶部栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="isCollapse = !isCollapse">
            <Fold v-if="!isCollapse" />
            <Expand v-else />
          </el-icon>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" icon="UserFilled" />
              <span class="username">{{ displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="changePassword">修改密码</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区 -->
      <el-main class="layout-content">
        <slot />
      </el-main>
    </el-container>

    <!-- 修改密码弹窗 -->
    <el-dialog
      v-model="pwdDialogVisible"
      title="修改密码"
      width="440px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        label-width="100px"
        @submit.prevent
      >
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            placeholder="请输入旧密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            placeholder="请输入新密码（至少6位）"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            placeholder="请再次输入新密码"
            show-password
            @keyup.enter="handleChangePassword"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdSaving" @click="handleChangePassword">
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </el-container>
</template>

<script setup lang="ts">
import {
  HomeFilled,
  Setting,
  Document,
  Files,
  Tools,
  Fold,
  Expand,
  ArrowDown,
  UserFilled,
  Coin,
  Wallet,
  CreditCard,
  Monitor,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useApi, getApiErrorMessage } from '~/composables/useApi'
import { useStoreData } from '~/composables/useStoreData'

const route = useRoute()
const api = useApi()
const { appName } = useAppBrand()
const isCollapse = ref(false)
const { fetchStores } = useStoreData()

const activeMenu = computed(() => route.path)

// —— 当前登录用户 ——
const displayName = ref('用户')

onMounted(() => {
  try {
    const raw = localStorage.getItem('user_info')
    if (raw) {
      const info = JSON.parse(raw)
      displayName.value = info.name || info.username || '用户'
    }
  } catch {
    // 解析失败，保持默认值
  }
  // 全局加载门店数据（供支付管理、预算管理、计提模板等模块使用）
  fetchStores()
})

// —— 下拉菜单命令处理 ——
function handleCommand(command: string) {
  if (command === 'changePassword') {
    openPwdDialog()
  } else if (command === 'logout') {
    handleLogout()
  }
}

// —— 退出登录 ——
async function handleLogout() {
  try {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }

  try {
    await api.post('/api/auth/logout')
  } catch {
    // 即使退出接口失败，仍清除本地状态
  } finally {
    localStorage.removeItem('token')
    localStorage.removeItem('user_info')
    ElMessage.success('已退出登录')
    navigateTo('/login')
  }
}

// —— 修改密码弹窗 ——
const pwdDialogVisible = ref(false)
const pwdSaving = ref(false)
const pwdFormRef = ref<FormInstance>()

const pwdForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const pwdRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: any) => {
        if (value !== pwdForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur',
    },
  ],
}

function openPwdDialog() {
  pwdForm.oldPassword = ''
  pwdForm.newPassword = ''
  pwdForm.confirmPassword = ''
  pwdDialogVisible.value = true
}

async function handleChangePassword() {
  if (!pwdFormRef.value) return
  try {
    await pwdFormRef.value.validate()
    pwdSaving.value = true

    await api.post('/api/auth/change-password', {
      oldPassword: pwdForm.oldPassword,
      newPassword: pwdForm.newPassword,
    })

    ElMessage.success('密码修改成功')
    pwdDialogVisible.value = false
  } catch (error: any) {
    // 表单校验失败不提示；API 错误提示后端消息
    if (error?.response?.status || error?.statusCode) {
      ElMessage.error(getApiErrorMessage(error))
    }
  } finally {
    pwdSaving.value = false
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

.layout-aside {
  background: var(--bg-card);
  border-right: 1px solid var(--border-lighter);
  transition: width 0.2s ease;
  overflow: hidden;
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-lighter);
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
  overflow: hidden;
}

.layout-menu {
  border-right: none;
  height: calc(100vh - 60px);
  overflow-y: auto;
}

.layout-menu:not(.el-menu--collapse) {
  width: 220px;
}

.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-lighter);
  height: 60px;
  padding: 0 20px;
}

.collapse-btn {
  font-size: var(--font-size-icon);
  cursor: pointer;
  color: var(--text-regular);
  transition: color 0.2s;
}

.collapse-btn:hover {
  color: var(--color-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.username {
  font-size: var(--font-size-body);
  color: var(--text-regular);
}

.layout-content {
  background: var(--bg-page);
  overflow-y: auto;
}
</style>
