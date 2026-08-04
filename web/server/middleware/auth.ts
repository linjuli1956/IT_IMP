/**
 * 全局认证中间件
 * 拦截所有 /api/ 路由，统一解析并验证 JWT token
 * - 排除 /api/auth/login（登录接口无需认证）
 * - 验证失败抛 401
 * - 验证成功将 user（userId/username/role）挂到 event.context.user
 *   供后续 handler 通过 requireRole 直接读取，避免重复解析
 */
import { getHeader, createError } from 'h3'
import { verifyToken, type CurrentUser } from '../utils/auth'

export default defineEventHandler((event) => {
  const path = event.path

  // 非 /api/ 路由直接放行（静态资源、页面路由等）
  if (!path.startsWith('/api/')) {
    return
  }

  // 登录接口不需要认证
  if (path.startsWith('/api/auth/login')) {
    return
  }

  // 从 Authorization 头解析 Bearer token
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  const token = parts[1]
  if (!token) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  // 验证 token 有效性
  const user = verifyToken(token)
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }

  // 将用户信息挂载到上下文，供后续 handler 通过 requireRole 读取
  event.context.user = user satisfies CurrentUser
})
