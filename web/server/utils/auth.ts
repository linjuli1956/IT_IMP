/**
 * 认证工具函数
 * 提供 bcrypt 密码哈希与 JWT token 签发/验证能力
 */
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createError, getHeader, getRequestIP, type H3Event } from 'h3'
import { networkInterfaces } from 'os'

/** JWT payload 结构 */
export interface JwtPayload {
  userId: number
  username: string
  role: string
}

/** 从事件中提取的当前用户信息 */
export interface CurrentUser extends JwtPayload {}

/**
 * 密码哈希 — 使用 bcrypt，saltRounds=10
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

/**
 * 密码比对 — 验证明文密码与哈希是否匹配
 */
export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash)
}

/**
 * 签发 JWT token — 有效期 7 天
 */
export function signToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未配置，服务无法启动。请在配置工具中设置 JWT 密钥。')
  }
  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

/**
 * 验证 JWT token
 * @returns 验证成功返回 payload，失败返回 null
 */
export function verifyToken(token: string): JwtPayload | null {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未配置，服务无法启动。请在配置工具中设置 JWT 密钥。')
  }
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload
    return decoded
  } catch {
    return null
  }
}

/**
 * 从请求事件中提取并验证当前用户
 * 从 Authorization: Bearer xxx 头中提取 token
 * @returns 验证成功返回用户信息，失败返回 null
 */
export function getUserFromEvent(event: H3Event): CurrentUser | null {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) return null

  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null

  const token = parts[1]
  if (!token) return null

  return verifyToken(token)
}

/**
 * 获取本机局域网 IP（非环回、非内部地址）
 * 优先返回 IPv4，其次 IPv6
 */
function getLanIp(): string {
  const nets = networkInterfaces()
  const results: string[] = []
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.internal) continue
      // 跳过链路本地地址（fe80::）
      if (net.family === 'IPv6' && net.address.startsWith('fe80')) continue
      results.push(net.address)
    }
  }
  // 优先返回 IPv4
  return results.find(ip => ip.includes('.')) || results[0] || ''
}

/**
 * 获取客户端 IP
 * 1. 优先读取 x-forwarded-for 头（反向代理场景）
 * 2. 不存在时回退到 TCP 连接的远端地址
 * 3. 去掉 IPv4-mapped IPv6 前缀（::ffff:）
 * 4. 环回地址（::1 / 127.0.0.1）→ 返回本机局域网 IP
 */
export function getClientIp(event: H3Event): string {
  let ip = getRequestIP(event, { xForwardedFor: true }) || ''

  // 去掉 IPv4-mapped IPv6 前缀
  ip = ip.replace(/^::ffff:/, '')

  // 环回地址 → 返回本机局域网 IP
  if (ip === '::1' || ip === '127.0.0.1') {
    return getLanIp() || ip
  }

  return ip
}

/**
 * 要求登录且具有指定角色之一（不满足则 throw createError）
 * - 从 event.context.user 读取用户信息（由 auth 中间件统一挂载）
 * - 若中间件未运行（漏配），context.user 为空 → 抛 401（兜底防护）
 * @param event H3 事件对象
 * @param roles 允许的角色列表，为空则只要求登录
 * @returns 当前登录用户信息
 */
export function requireRole(event: H3Event, ...roles: string[]): CurrentUser {
  const user = event.context.user as CurrentUser | undefined
  if (!user) {
    throw createError({ statusCode: 401, message: '未登录或登录已过期' })
  }
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw createError({ statusCode: 403, message: '权限不足' })
  }
  return user
}
