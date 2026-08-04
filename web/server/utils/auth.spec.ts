import { describe, it, expect, beforeAll, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

// Mock 'os' 模块，使 getLanIp 返回可预测的地址
vi.mock('os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('os')>()
  return {
    ...actual,
    networkInterfaces: () => ({
      'eth0': [
        { address: '192.168.0.100', family: 'IPv4', netmask: '255.255.255.0', internal: false },
      ],
      'lo': [
        { address: '127.0.0.1', family: 'IPv4', netmask: '255.255.0.0', internal: true },
        { address: '::1', family: 'IPv6', netmask: '::1', internal: true },
      ],
    }),
  }
})

// 导入被测模块（mock 已生效）
import {
  hashPassword,
  comparePassword,
  signToken,
  verifyToken,
  getUserFromEvent,
  requireRole,
  getClientIp,
} from './auth'

// 在所有测试前设置 JWT_SECRET（任务#002 移除 fallback 后必需）
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret'
})

// ─── 辅助函数 ──────────────────────────────────────────

/** 构造最小化 mock H3Event 对象 */
function createMockEvent(
  headers: Record<string, string> = {},
  remoteAddress?: string,
): H3Event {
  return {
    node: {
      req: {
        headers,
        socket: remoteAddress !== undefined ? { remoteAddress } : undefined,
      },
    },
    context: {},
  } as unknown as H3Event
}

// ─── hashPassword / comparePassword ───────────────────

describe('hashPassword / comparePassword', () => {
  it('哈希后与原文比对成功', () => {
    const hash = hashPassword('mypassword')
    expect(comparePassword('mypassword', hash)).toBe(true)
  })

  it('错误密码比对失败', () => {
    const hash = hashPassword('mypassword')
    expect(comparePassword('wrongpassword', hash)).toBe(false)
  })

  it('相同密码两次哈希结果不同(salt)', () => {
    const hash1 = hashPassword('samepassword')
    const hash2 = hashPassword('samepassword')
    expect(hash1).not.toBe(hash2)
    // 但两个哈希都能通过比对
    expect(comparePassword('samepassword', hash1)).toBe(true)
    expect(comparePassword('samepassword', hash2)).toBe(true)
  })
})

// ─── signToken / verifyToken ──────────────────────────

describe('signToken / verifyToken', () => {
  it('签发后验证成功返回payload', () => {
    const payload = { userId: 1, username: 'admin', role: 'admin' }
    const token = signToken(payload)
    const decoded = verifyToken(token)
    expect(decoded).not.toBeNull()
    expect(decoded!.userId).toBe(1)
    expect(decoded!.username).toBe('admin')
    expect(decoded!.role).toBe('admin')
  })

  it('篡改token验证失败返回null', () => {
    const token = signToken({ userId: 1, username: 'admin', role: 'admin' })
    // 修改 token 末尾几个字符使其签名失效
    const tampered = token.slice(0, -5) + 'XXXXX'
    expect(verifyToken(tampered)).toBeNull()
  })

  it('过期token验证失败', () => {
    // 直接用 jwt.sign 创建一个已过期的 token（exp 设为 1 小时前）
    const expiredToken = jwt.sign(
      { userId: 1, username: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) - 3600 },
      'test-secret',
    )
    expect(verifyToken(expiredToken)).toBeNull()
  })
})

// ─── getUserFromEvent ─────────────────────────────────

describe('getUserFromEvent', () => {
  it('有效Bearer头返回用户', () => {
    const token = signToken({ userId: 1, username: 'admin', role: 'admin' })
    const event = createMockEvent({ authorization: `Bearer ${token}` })
    const user = getUserFromEvent(event)
    expect(user).not.toBeNull()
    expect(user!.userId).toBe(1)
    expect(user!.username).toBe('admin')
  })

  it('无Authorization头返回null', () => {
    const event = createMockEvent({})
    expect(getUserFromEvent(event)).toBeNull()
  })

  it('格式错误返回null', () => {
    // 非 "Bearer xxx" 格式
    const event = createMockEvent({ authorization: 'InvalidFormat sometoken' })
    expect(getUserFromEvent(event)).toBeNull()
  })
})

// ─── requireRole ──────────────────────────────────────

describe('requireRole', () => {
  it('未登录抛401', () => {
    const event = createMockEvent({})
    try {
      requireRole(event)
      expect.unreachable('应该抛出 401 错误')
    } catch (e: any) {
      expect(e.statusCode).toBe(401)
      expect(e.message).toBe('未登录或登录已过期')
    }
  })

  it('角色不匹配抛403', () => {
    const event = createMockEvent()
    event.context.user = { userId: 2, username: 'user', role: 'user' }
    try {
      requireRole(event, 'admin')
      expect.unreachable('应该抛出 403 错误')
    } catch (e: any) {
      expect(e.statusCode).toBe(403)
      expect(e.message).toBe('权限不足')
    }
  })

  it('角色匹配返回用户', () => {
    const event = createMockEvent()
    event.context.user = { userId: 1, username: 'admin', role: 'admin' }
    const user = requireRole(event, 'admin')
    expect(user.userId).toBe(1)
    expect(user.username).toBe('admin')
  })

  it('无roles参数只验证登录', () => {
    const event = createMockEvent()
    event.context.user = { userId: 2, username: 'user', role: 'user' }
    const user = requireRole(event)
    expect(user.userId).toBe(2)
    expect(user.username).toBe('user')
  })
})

// ─── getClientIp ──────────────────────────────────────

describe('getClientIp', () => {
  it('有x-forwarded-for返回该IP', () => {
    const event = createMockEvent({ 'x-forwarded-for': '1.2.3.4' })
    expect(getClientIp(event)).toBe('1.2.3.4')
  })

  it('环回地址返回LAN IP(非::1/127.0.0.1)', () => {
    const event = createMockEvent({}, '::1')
    const ip = getClientIp(event)
    expect(ip).not.toBe('::1')
    expect(ip).not.toBe('127.0.0.1')
    expect(ip).toBe('192.168.0.100') // mocked LAN IP
  })

  it('::ffff:前缀被去除', () => {
    const event = createMockEvent({}, '::ffff:10.0.0.1')
    expect(getClientIp(event)).toBe('10.0.0.1')
  })

  it('远程IP原样返回', () => {
    const event = createMockEvent({}, '203.0.113.5')
    expect(getClientIp(event)).toBe('203.0.113.5')
  })
})
