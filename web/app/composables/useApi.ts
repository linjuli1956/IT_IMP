/**
 * API 请求工具
 * - 自动注入 Authorization Header（token 从 localStorage 读取）
 * - 统一 401 拦截：清除 token + 跳转登录页
 * - SSR 兼容：localStorage 仅在客户端可用
 */
import { ElMessage } from 'element-plus'

export function useApi() {
  /** 从 localStorage 获取 token（SSR 安全） */
  const getToken = (): string | null => {
    if (import.meta.client) {
      return localStorage.getItem('token')
    }
    return null
  }

  /** 核心请求方法 */
  async function request<T = any>(
    url: string,
    options: Record<string, any> = {},
  ): Promise<T> {
    const token = getToken()
    const headers: Record<string, string> = {
      ...(options.headers || {}),
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    try {
      return await $fetch<T>(url, {
        ...options,
        headers,
      })
    } catch (error: any) {
      const status = error?.response?.status || error?.statusCode

      // 401 → 清除 token + 跳转登录页
      if (status === 401 && import.meta.client) {
        localStorage.removeItem('token')
        localStorage.removeItem('user_info')
        ElMessage.error('登录已过期，请重新登录')
        navigateTo('/login')
      }

      throw error
    }
  }

  return {
    get: <T = any>(url: string, options?: Record<string, any>) =>
      request<T>(url, { ...options, method: 'GET' }),
    post: <T = any>(url: string, body?: any, options?: Record<string, any>) =>
      request<T>(url, { ...options, method: 'POST', body }),
    put: <T = any>(url: string, body?: any, options?: Record<string, any>) =>
      request<T>(url, { ...options, method: 'PUT', body }),
    delete: <T = any>(url: string, options?: Record<string, any>) =>
      request<T>(url, { ...options, method: 'DELETE' }),
  }
}

/** 从 API 错误对象中提取后端返回的错误消息 */
export function getApiErrorMessage(error: any): string {
  return (
    error?.data?.message ||
    error?.response?._data?.message ||
    '操作失败，请重试'
  )
}
