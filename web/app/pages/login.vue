<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <el-icon size="40" color="var(--color-primary)"><Coin /></el-icon>
        <h1 class="login-title">泰兴超市信息部</h1>
        <p class="login-subtitle">综合管理平台 V0.01</p>
      </div>

      <el-form
        ref="formRef"
        :model="loginForm"
        :rules="rules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="loginForm.username"
            size="large"
            placeholder="请输入用户名"
            :prefix-icon="User"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="loginForm.password"
            size="large"
            type="password"
            placeholder="请输入密码"
            :prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登 录
          </el-button>
        </el-form-item>
      </el-form>

      <div class="login-footer">
        © 2026 泰兴超市信息部
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { User, Lock, Coin } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { LoginResponse } from '~/types/auth'

definePageMeta({ layout: false })

const formRef = ref<FormInstance>()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    loading.value = true

    const data = await $fetch<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: {
        username: loginForm.username,
        password: loginForm.password,
      },
    })

    // 存储 token 和用户信息
    localStorage.setItem('token', data.token)
    localStorage.setItem('user_info', JSON.stringify(data.user))

    navigateTo('/')
  } catch (error: any) {
    const message = error?.data?.message || '登录失败，请检查用户名和密码'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary-light) 0%, var(--bg-card) 50%, var(--color-primary-border) 100%);
}

.login-card {
  width: 400px;
  padding: 40px;
  background: var(--bg-card);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-dialog);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-title {
  font-size: var(--font-size-large);
  font-weight: 600;
  color: var(--text-primary);
  margin: 12px 0 4px;
}

.login-subtitle {
  font-size: var(--font-size-small);
  color: var(--text-secondary);
}

.login-form {
  margin-bottom: 16px;
}

.login-btn {
  width: 100%;
}

.login-footer {
  text-align: center;
  font-size: var(--font-size-mini);
  color: var(--text-placeholder);
}
</style>
