<template>
  <el-container class="layout-container">
    <!-- 侧边栏 -->
    <el-aside :width="isCollapse ? '64px' : '220px'" class="layout-aside">
      <div class="logo">
        <el-icon size="24" color="var(--color-primary)"><Coin /></el-icon>
        <span v-if="!isCollapse" class="logo-text">{{ appName }}</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :default-openeds="defaultOpeneds"
        :collapse="isCollapse"
        :collapse-transition="false"
        background-color="var(--sidebar-bg)"
        text-color="var(--sidebar-text)"
        active-text-color="var(--sidebar-text-active)"
        router
        class="layout-menu"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>首页</span>
        </el-menu-item>

        <el-sub-menu index="expense" popper-class="layout-menu-popup">
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

        <el-sub-menu index="config" popper-class="layout-menu-popup">
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

        <el-sub-menu index="it" popper-class="layout-menu-popup">
          <template #title>
            <el-icon><Monitor /></el-icon>
            <span>IT资产管理</span>
          </template>
          <el-menu-item index="/it/servers">服务器管理</el-menu-item>
          <el-menu-item index="/it/network-devices">网络设备</el-menu-item>
          <el-menu-item index="/it/phones">固话管理</el-menu-item>
          <el-menu-item index="/it/computers">电脑管理</el-menu-item>
          <el-menu-item index="/it/scales">电子称管理</el-menu-item>
          <el-menu-item index="/it/domains">域名管理</el-menu-item>
          <el-menu-item index="/it/miniapps">小程序管理</el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="system" popper-class="layout-menu-popup">
          <template #title>
            <el-icon><Tools /></el-icon>
            <span>系统管理</span>
          </template>
          <el-menu-item index="/system/users">用户管理</el-menu-item>
          <el-menu-item index="/system/logs">操作日志</el-menu-item>
          <el-menu-item index="/system/settings">系统设置</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 右侧主体 -->
    <el-container class="layout-main">
      <!-- 顶部栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <button
            class="collapse-btn"
            type="button"
            :aria-label="isCollapse ? '展开侧边栏' : '折叠侧边栏'"
            @click="isCollapse = !isCollapse"
          >
            <el-icon>
              <Fold v-if="!isCollapse" />
              <Expand v-else />
            </el-icon>
          </button>
          <el-breadcrumb separator="/" class="header-breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="parentTitle">{{ parentTitle }}</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
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
import { useSettingsData } from '~/composables/useSettingsData'

const route = useRoute()
const api = useApi()
const { appName } = useAppBrand()
const isCollapse = ref(false)
const { fetchStores } = useStoreData()
const { fetchSettings } = useSettingsData()


// —— 当前登录用户 ——
const displayName = ref('用户')

/** 路由 → 页面标题（面包屑显示，与侧边栏菜单一致） */
const routeTitleMap: Record<string, string> = {
  '/': '首页',
  '/invoices/upload': '上传发票',
  '/invoices/batches': '批次列表',
  '/invoices/list': '发票列表',
  '/details': '明细表管理',
  '/accruals': '计提表列表',
  '/config/stores': '部门门店机构',
  '/config/templates': '计提模板',
  '/config/fee-schemes': '费用分摊方案',
  '/config/suppliers': '客户管理',
  '/contracts': '合同管理',
  '/budget': '预算管理',
  '/payment': '支付管理',
  '/it/servers': '服务器管理',
  '/design/server-workspace': '服务器管理',
  '/it/network-devices': '网络设备',
  '/it/phones': '固话管理',
  '/it/computers': '电脑管理',
  '/it/scales': '电子称管理',
  '/it/domains': '域名管理',
  '/it/miniapps': '小程序管理',
  '/system/users': '用户管理',
  '/system/logs': '操作日志',
  '/system/settings': '系统设置',
}

/** 路由 → 所属一级菜单标题（面包屑第二级显示） */
const routeParentMap: Record<string, string> = {
  '/it/servers': 'IT资产管理',
  '/it/network-devices': 'IT资产管理',
  '/it/phones': 'IT资产管理',
  '/it/computers': 'IT资产管理',
  '/it/scales': 'IT资产管理',
  '/it/domains': 'IT资产管理',
  '/it/miniapps': 'IT资产管理',
  '/design/server-workspace': 'IT资产管理',
}

/** 详情页等子路由归并到一级菜单标题 */
const currentTitle = computed(() => {
  const path = route.path
  if (path === '/') return ''
  if (path.startsWith('/it/servers/')) return '服务器管理'
  if (path.startsWith('/invoices/')) return routeTitleMap[path] || '发票管理'
  return routeTitleMap[path] || ''
})

/** 面包屑父级标题（如有） */
const parentTitle = computed(() => routeParentMap[route.path] || '')

/** 侧栏高亮：设计稿页面映射到对应正式菜单项 */
const activeMenu = computed(() => {
  const path = route.path
  if (path.startsWith('/design/server-workspace')) return '/it/servers'
  return path
})

/** 默认展开的子菜单 */
const defaultOpeneds = computed(() => {
  const parent = routeParentMap[route.path]
  if (parent === 'IT资产管理') return ['it']
  return []
})

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
  // 全局加载系统设置（财年起始月等参数，供预算/首页使用）
  fetchSettings()
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

/* —— 深色侧边栏 —— */
.layout-aside {
  background: var(--sidebar-bg);
  border-right: none;
  transition: width var(--transition-base);
  overflow: hidden;
}

.logo {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--sidebar-logo-bg);
  border-bottom: 1px solid var(--sidebar-bg-hover);
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--sidebar-text-active);
  white-space: nowrap;
  overflow: hidden;
  min-width: 0;
}

.logo-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.layout-menu {
  border-right: none;
  height: calc(100vh - var(--header-height));
  overflow-y: auto;
  padding: 8px;
  background: var(--sidebar-bg) !important;
}

.layout-menu:not(.el-menu--collapse) {
  width: var(--sidebar-width);
}

/* —— 侧边栏菜单项（深色主题定制）—— */
.layout-aside :deep(.el-menu-item),
.layout-aside :deep(.el-sub-menu__title) {
  color: var(--sidebar-text) !important;
  border-radius: var(--radius-md);
  margin-bottom: 2px;
  height: 44px;
  line-height: 44px;
  transition: background var(--transition-base), color var(--transition-base);
}

.layout-aside :deep(.el-menu-item:hover),
.layout-aside :deep(.el-sub-menu__title:hover) {
  background: var(--sidebar-bg-hover) !important;
  color: var(--sidebar-text-active) !important;
}

.layout-aside :deep(.el-menu-item.is-active) {
  background: var(--sidebar-bg-active) !important;
  color: var(--sidebar-text-active) !important;
  font-weight: 600;
  position: relative;
}

.layout-aside :deep(.el-menu-item.is-active)::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--sidebar-indicator);
  border-radius: 0 2px 2px 0;
}

.layout-aside :deep(.el-sub-menu .el-menu-item) {
  padding-left: 40px !important;
  height: 40px;
  line-height: 40px;
}

/* —— 顶部栏 —— */
.layout-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--header-bg);
  border-bottom: 1px solid var(--header-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  height: var(--header-height);
  padding: 0 var(--spacing-page);
  z-index: var(--z-header);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* 面包屑：当前页主文字色，父级次要色 */
.header-breadcrumb {
  font-size: var(--font-size-body);
}

.header-breadcrumb :deep(.el-breadcrumb__item .el-breadcrumb__inner) {
  color: var(--text-secondary);
  font-weight: 400;
}

.header-breadcrumb :deep(.el-breadcrumb__item:last-child .el-breadcrumb__inner) {
  color: var(--text-primary);
  font-weight: 500;
}

.collapse-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-icon);
  color: var(--text-regular);
  transition: color var(--transition-base), background var(--transition-base);
}

.collapse-btn:hover,
.collapse-btn:focus-visible {
  color: var(--color-primary);
  background: var(--bg-hover);
}

/* 用户头像区 hover 背景 */
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: var(--radius-md);
  transition: background var(--transition-base);
}

.user-info:hover {
  background: var(--bg-hover);
}

.username {
  font-size: var(--font-size-body);
  color: var(--text-regular);
}

.layout-content {
  background: var(--content-bg);
  overflow-y: auto;
}
</style>

<style>
/* 折叠态子菜单 Popup — Teleport 到 body，scoped 无法匹配，须用全局样式 */
.layout-menu-popup {
  background: var(--sidebar-bg) !important;
}
.layout-menu-popup .el-menu {
  background: var(--sidebar-bg) !important;
}
.layout-menu-popup .el-menu-item {
  color: var(--sidebar-text) !important;
  border-radius: var(--radius-md);
  margin-bottom: 2px;
  height: 44px;
  line-height: 44px;
  transition: background var(--transition-base), color var(--transition-base);
}
.layout-menu-popup .el-menu-item:hover {
  background: var(--sidebar-bg-hover) !important;
  color: var(--sidebar-text-active) !important;
}
.layout-menu-popup .el-menu-item.is-active {
  background: var(--sidebar-bg-active) !important;
  color: var(--sidebar-text-active) !important;
  font-weight: 600;
  position: relative;
}
.layout-menu-popup .el-menu-item.is-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 60%;
  background: var(--sidebar-indicator);
  border-radius: 0 2px 2px 0;
}
</style>
