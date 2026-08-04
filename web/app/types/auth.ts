/**
 * 认证与用户管理类型定义
 */

/** 用户对象（不含密码哈希） */
export interface User {
  id: number
  username: string
  name: string
  role: string
  status: number
  lastLogin: string | null
  createdAt: string
}

/** 登录响应 */
export interface LoginResponse {
  token: string
  user: {
    id: number
    username: string
    name: string
    role: string
  }
}
