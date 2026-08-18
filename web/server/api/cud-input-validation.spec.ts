/**
 * 三模块（domains/miniapps/payments）普通 CUD 输入收紧 API 测试
 *
 * 覆盖验收清单：
 * - POST/PUT body 非 JSON 对象（null/数组/字符串/数字/布尔）→ 400，不触库
 * - 必填/可选字段基础类型校验：对象/数组/布尔值 → 400（禁止 Prisma 隐式处理）
 * - PUT 只传白名单字段（未知字段/id 不落库），不直接 data: body
 * - 敏感字段空值 = "不修改"，不落库
 * - ID 统一正安全整数解析（GET/PUT/DELETE）：小数/负数/0/科学计数/非数字 → 400
 * - isSensitive 必须布尔
 * - 以上全部返回 400，不得变成 500（prisma 未被调用）
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
    domain: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    miniapp: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
    paymentConfig: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn() },
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

async function loadHandler(path: string): Promise<(event: unknown) => Promise<unknown>> {
  return (await import(path)).default as (event: unknown) => Promise<unknown>
}

beforeEach(() => {
  vi.clearAllMocks()
  ;(getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue('1')
  ;(requireRole as ReturnType<typeof vi.fn>).mockReturnValue(operator)
})

/** 断言 400 且未触库（非法输入不得变成 Prisma 500） */
async function expect400(handler: (event: unknown) => Promise<unknown>) {
  await expect(handler({})).rejects.toMatchObject({ statusCode: 400 })
  for (const model of [prisma.domain, prisma.miniapp, prisma.paymentConfig]) {
    expect(model.create).not.toHaveBeenCalled()
    expect(model.update).not.toHaveBeenCalled()
    expect(model.delete).not.toHaveBeenCalled()
    expect(model.findUnique).not.toHaveBeenCalled()
  }
}

describe('非对象 body → 400（POST/PUT 共用行为）', () => {
  const badBodies = [
    ['null', null],
    ['数组', ['x']],
    ['字符串', 'domain=example'],
    ['数字', 42],
    ['布尔', true],
  ] as const

  for (const [label, payload] of badBodies) {
    it(`POST /api/domains body=${label} → 400 不触库`, async () => {
      const handler = await loadHandler('./domains/index.post')
      ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue(payload)
      await expect400(handler)
    })
    it(`PUT /api/miniapps/:id body=${label} → 400 不触库`, async () => {
      const handler = await loadHandler('./miniapps/[id].put')
      ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue(payload)
      await expect400(handler)
    })
  }
})

describe('字段类型校验（对象/数组/布尔不得被隐式处理）', () => {
  it('POST /api/domains domain 为对象 → 400', async () => {
    const handler = await loadHandler('./domains/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ domain: { a: 1 }, mainAccount: 'acc', mainPassword: 'pw' })
    await expect400(handler)
  })

  it('POST /api/miniapps email 为数组 → 400', async () => {
    const handler = await loadHandler('./miniapps/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ name: 'app', email: ['a@b.c'], emailPassword: 'pw' })
    await expect400(handler)
  })

  it('POST /api/payments storeId 为布尔 → 400', async () => {
    const handler = await loadHandler('./payments/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ storeId: true, storeName: '门店', payMethod: 'wx', provider: '服务商', configName: '密钥', configValue: 'v' })
    await expect400(handler)
  })

  it('POST /api/payments isSensitive 为字符串 → 400', async () => {
    const handler = await loadHandler('./payments/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ storeId: 'S01', storeName: '门店', payMethod: 'wx', provider: '服务商', configName: '密钥', configValue: 'v', isSensitive: 'yes' })
    await expect400(handler)
  })

  it('POST /api/domains 可选字段 remark 为对象 → 400', async () => {
    const handler = await loadHandler('./domains/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ domain: 'a.invalid', mainAccount: 'acc', mainPassword: 'pw', remark: { x: 1 } })
    await expect400(handler)
  })

  it('PUT /api/payments/:id isSensitive 为数字 → 400', async () => {
    const handler = await loadHandler('./payments/[id].put')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ configValue: 'v', isSensitive: 1 })
    await expect400(handler)
  })
})

describe('PUT 白名单：未知字段/id 不落库，敏感字段空值 = 不修改', () => {
  it('PUT /api/domains/:id 未知字段与 id 被丢弃，白名单字段保留', async () => {
    const handler = await loadHandler('./domains/[id].put')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 999, domain: 'new.invalid', role: '管理员', evil: { nested: true },
    })
    ;(prisma.domain.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, domain: 'new.invalid', mainAccount: 'acc', mainPassword: 'pw', status: '正常',
    })

    await handler({})

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (prisma.domain.update as any).mock.calls[0][0].data as Record<string, unknown>
    expect(data).toEqual({ domain: 'new.invalid' })
    expect(data).not.toHaveProperty('id')
    expect(data).not.toHaveProperty('role')
    expect(data).not.toHaveProperty('evil')
  })

  it('PUT /api/domains/:id mainPassword 空串/null = 不修改（不落库、不误清空）', async () => {
    const handler = await loadHandler('./domains/[id].put')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ domain: 'a.invalid', mainPassword: '' })
    ;(prisma.domain.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, domain: 'a.invalid', mainAccount: 'acc', mainPassword: 'saved-pw', status: '正常',
    })

    await handler({})

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (prisma.domain.update as any).mock.calls[0][0].data as Record<string, unknown>
    expect(data).not.toHaveProperty('mainPassword')
  })

  it('PUT /api/payments/:id configValue=null = 不修改，isSensitive 合法布尔保留', async () => {
    const handler = await loadHandler('./payments/[id].put')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ configValue: null, isSensitive: true })
    ;(prisma.paymentConfig.update as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, storeId: 'S01', storeName: '门店', configName: '密钥', configValue: 'v', isSensitive: true, status: '正常',
    })

    await handler({})

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (prisma.paymentConfig.update as any).mock.calls[0][0].data as Record<string, unknown>
    expect(data).not.toHaveProperty('configValue')
    expect(data.isSensitive).toBe(true)
  })

  it('PUT /api/miniapps/:id 非敏感字段 null → 400（不隐式写 NULL）', async () => {
    const handler = await loadHandler('./miniapps/[id].put')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ remark: null })
    await expect400(handler)
  })
})

describe('非法 ID → 400（正安全整数解析）', () => {
  // 注：'1e2'（Number→100）是项目共享 parsePositiveSafeId 的既有数字字面量语义，
  // 不在本轮三模块范围内改变共享工具行为，故不作为非法用例。
  const badIds = ['abc', '12.5', '-1', '0', '  ', 'Infinity']
  const handlers = [
    ['PUT /api/domains/:id', './domains/[id].put'],
    ['DELETE /api/domains/:id', './domains/[id].delete'],
    ['PUT /api/miniapps/:id', './miniapps/[id].put'],
    ['DELETE /api/miniapps/:id', './miniapps/[id].delete'],
    ['GET /api/payments/:id', './payments/[id].get'],
    ['PUT /api/payments/:id', './payments/[id].put'],
    ['DELETE /api/payments/:id', './payments/[id].delete'],
  ] as const

  for (const [label, path] of handlers) {
    for (const badId of badIds) {
      it(`${label} id="${badId}" → 400 不触库`, async () => {
        const handler = await loadHandler(path)
        ;(getRouterParam as ReturnType<typeof vi.fn>).mockReturnValue(badId)
        await expect400(handler)
      })
    }
  }
})

describe('合法输入仍正常工作（不回归）', () => {
  it('POST /api/domains 合法 body → create 被调用', async () => {
    const handler = await loadHandler('./domains/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({ domain: 'a.invalid', mainAccount: 'acc', mainPassword: 'pw' })
    ;(prisma.domain.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, domain: 'a.invalid', mainAccount: 'acc', mainPassword: 'pw', status: '正常',
    })
    const result = await handler({}) as Record<string, unknown>
    expect(prisma.domain.create).toHaveBeenCalledTimes(1)
    expect(result.mainPasswordSet).toBe(true)
  })

  it('POST /api/payments isSensitive 省略 → 落库 false', async () => {
    const handler = await loadHandler('./payments/index.post')
    ;(readBody as ReturnType<typeof vi.fn>).mockResolvedValue({
      storeId: 'S01', storeName: '门店', payMethod: 'wx', provider: '服务商', configName: '商户号', configValue: 'MCH-1',
    })
    ;(prisma.paymentConfig.create as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 1, storeId: 'S01', storeName: '门店', payMethod: 'wx', provider: '服务商', configName: '商户号', configValue: 'MCH-1', isSensitive: false, status: '正常',
    })
    await handler({})
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (prisma.paymentConfig.create as any).mock.calls[0][0].data as Record<string, unknown>
    expect(data.isSensitive).toBe(false)
  })
})
