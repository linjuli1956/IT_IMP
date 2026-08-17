/**
 * 敏感值显式查看接口 + CUD 响应泄露 API 测试
 *
 * 覆盖验收清单：
 * - 查看者访问显式查看接口 403
 * - 管理员/操作员显式查看成功（返回明文，仅此出口）
 * - 非法 body 400
 * - 操作日志只记录动作与对象，不含密码/敏感值
 * - CUD（PUT/POST）响应不泄露明文
 *
 * 说明：handler 依赖 Nitro auto-import（defineEventHandler/createError），
 * 测试通过 globalThis stub + 动态 import 加载，无需启动 Nuxt 服务器。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// h3 mock：readBody/getRouterParam 可控，createError 转为带 statusCode 的 Error
vi.mock('h3', () => ({
  readBody: vi.fn(),
  getRouterParam: vi.fn(),
  createError: (opts: { statusCode: number; message: string }) =>
    Object.assign(new Error(opts.message), { statusCode: opts.statusCode }),
}))

vi.mock('../utils/prisma', () => ({
  prisma: {
    domain: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    miniapp: { findUnique: vi.fn() },
    paymentConfig: { findUnique: vi.fn(), create: vi.fn() },
    operationLog: { create: vi.fn() },
  },
}))

vi.mock('../utils/auth', () => ({
  requireRole: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}))

import { readBody, getRouterParam } from 'h3'
import { prisma } from '../utils/prisma'
import { requireRole } from '../utils/auth'

// Nitro auto-import stub（必须在动态 import handler 前就绪）
const g = globalThis as Record<string, unknown>
g.defineEventHandler = (handler: unknown) => handler
g.createError = (opts: { statusCode: number; message: string }) =>
  Object.assign(new Error(opts.message), { statusCode: opts.statusCode })

const operator = { userId: 2, username: 'operator', role: '操作员' }
const viewer403 = Object.assign(new Error('无权限'), { statusCode: 403 })

async function loadHandler(path: string): Promise<(event: unknown) => Promise<unknown>> {
  return (await import(path)).default as (event: unknown) => Promise<unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('1')
})

describe('POST /api/domains/:id/password（显式查看主账号密码）', () => {
  it('查看者访问 → 403', async () => {
    const handler = await loadHandler('./domains/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockImplementation(() => { throw viewer403 })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('操作员 view → 返回 mainPassword；操作日志不含密码明文', async () => {
    const handler = await loadHandler('./domains/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'view' })
    ;(prisma.domain.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, domain: 'example.invalid', mainPassword: 'domain-secret-pw',
    })

    const result = await handler({}) as { mainPassword: string }
    expect(result.mainPassword).toBe('domain-secret-pw')

    // 日志只记录动作与对象
    expect(prisma.operationLog.create).toHaveBeenCalledTimes(1)
    const logCall = JSON.stringify((prisma.operationLog.create as ReturnType<typeof vi.fn>).mock.calls[0])
    expect(logCall).toContain('查看域名')
    expect(logCall).not.toContain('domain-secret-pw')
  })

  it('非法 body（action 非 view）→ 400', async () => {
    const handler = await loadHandler('./domains/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'update' })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })

  it('域名不存在 → 404', async () => {
    const handler = await loadHandler('./domains/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'view' })
    ;(prisma.domain.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(handler({})).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('POST /api/miniapps/:id/password（显式查看邮箱密码）', () => {
  it('查看者访问 → 403', async () => {
    const handler = await loadHandler('./miniapps/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockImplementation(() => { throw viewer403 })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('操作员 view → 返回 emailPassword；日志不含明文', async () => {
    const handler = await loadHandler('./miniapps/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'view' })
    ;(prisma.miniapp.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, name: '小程序A', emailPassword: 'mail-secret-pw',
    })

    const result = await handler({}) as { emailPassword: string }
    expect(result.emailPassword).toBe('mail-secret-pw')
    const logCall = JSON.stringify((prisma.operationLog.create as ReturnType<typeof vi.fn>).mock.calls[0])
    expect(logCall).toContain('查看小程序')
    expect(logCall).not.toContain('mail-secret-pw')
  })

  it('非法 body（空 body）→ 400', async () => {
    const handler = await loadHandler('./miniapps/[id]/password.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('POST /api/payments/:id/config-value（显式查看敏感配置值）', () => {
  it('查看者访问 → 403', async () => {
    const handler = await loadHandler('./payments/[id]/config-value.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockImplementation(() => { throw viewer403 })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 403 })
  })

  it('操作员 view → 返回 configValue；日志不含明文', async () => {
    const handler = await loadHandler('./payments/[id]/config-value.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'view' })
    ;(prisma.paymentConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, storeName: '门店', configName: '密钥', configValue: 'pay-api-secret', isSensitive: true,
    })

    const result = await handler({}) as { configValue: string; isSensitive: boolean }
    expect(result.configValue).toBe('pay-api-secret')
    expect(result.isSensitive).toBe(true)
    const logCall = JSON.stringify((prisma.operationLog.create as ReturnType<typeof vi.fn>).mock.calls[0])
    expect(logCall).toContain('查看支付配置')
    expect(logCall).not.toContain('pay-api-secret')
  })

  it('非法 body（action 非 view）→ 400', async () => {
    const handler = await loadHandler('./payments/[id]/config-value.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ action: 'view-all' })
    await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('CUD 响应不泄露（PUT/POST 走脱敏 DTO）', () => {
  it('PUT /api/domains/:id 响应无 mainPassword（即使数据库返回明文）', async () => {
    const handler = await loadHandler('./domains/[id].put')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ domain: 'example.invalid', mainPassword: '' })
    ;(prisma.domain.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, domain: 'example.invalid', mainAccount: 'acc', mainPassword: 'domain-secret-pw', status: '正常',
    })

    const result = await handler({}) as Record<string, unknown>
    expect(result).not.toHaveProperty('mainPassword')
    expect(JSON.stringify(result)).not.toContain('domain-secret-pw')
    expect(result.mainPasswordSet).toBe(true)

    // 空密码不落库：update 收到的 data 不含 mainPassword
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = (prisma.domain.update as any).mock.calls[0][0].data as Record<string, unknown>
    expect(updateData).not.toHaveProperty('mainPassword')
  })

  it('POST /api/payments 敏感配置响应无 configValue', async () => {
    const handler = await loadHandler('./payments/index.post')
    ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      storeId: 'S01', storeName: '门店', payMethod: 'wx', payMethodName: '微信',
      provider: '服务商', configName: '密钥', configValue: 'pay-api-secret', isSensitive: true,
    })
    ;(prisma.paymentConfig.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, storeId: 'S01', storeName: '门店', payMethod: 'wx', payMethodName: '微信',
      provider: '服务商', configName: '密钥', configValue: 'pay-api-secret', posNo: '', status: '正常', isSensitive: true,
    })

    const result = await handler({}) as Record<string, unknown>
    expect(result).not.toHaveProperty('configValue')
    expect(JSON.stringify(result)).not.toContain('pay-api-secret')
    expect(result.sensitiveConfigured).toBe(true)
  })
})
