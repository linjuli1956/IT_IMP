/**
 * 全局路由守卫
 * - 排除 /login 页面
 * - 无 token → 跳转登录页
 * - SSR 兼容：localStorage 仅在客户端检查
 */
export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client) return

  // 排除登录页
  if (to.path === '/login') return

  // 无 token → 跳转登录页
  const token = localStorage.getItem('token')
  if (!token) {
    return navigateTo('/login')
  }
})
