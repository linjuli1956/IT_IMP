/**
 * /files/** 登录保护 API 测试
 * 验收要求：
 * - 匿名（无 Authorization）→ 401
 * - 无效 token → 401
 * - 已登录用户（任意角色 token 有效）→ 可正常读取文件
 * - 登录用户访问不存在的文件 → 404（原有行为不回归）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getRouterParamMock, getHeaderMock, setHeaderMock, verifyTokenMock, statMock, readFileMock } = vi.hoisted(() => ({
  getRouterParamMock: vi.fn(),
  getHeaderMock: vi.fn(),
  setHeaderMock: vi.fn(),
  verifyTokenMock: vi.fn(),
  statMock: vi.fn(),
  readFileMock: vi.fn(),
}))

vi.mock('h3', () => ({
  getRouterParam: getRouterParamMock,
  getHeader: getHeaderMock,
  setHeader: setHeaderMock,
  createError: (opts: { statusCode?: number; message?: string }) =>
    Object.assign(new Error(opts.message), { statusCode: opts.statusCode }),
}))

vi.mock('../../utils/auth', () => ({ verifyToken: verifyTokenMock }))
vi.mock('fs/promises', () => ({ stat: statMock, readFile: readFileMock }))

// Nitro auto-import stub（handler 内 defineEventHandler/createError 无显式 import）
const g = globalThis as Record<string, unknown>
g.defineEventHandler = (handler: unknown) => handler
g.createError = (opts: { statusCode?: number; message?: string }) =>
  Object.assign(new Error(opts.message), { statusCode: opts.statusCode })

async function loadHandler() {
  return (await import('./[...path]')).default
}

function makeEvent() {
  return { path: '/files/uploads/a.pdf' } as never
}

describe('GET /files/** 登录保护', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getHeaderMock.mockReturnValue(undefined)
    getRouterParamMock.mockReturnValue('uploads/invoices/batch-1/a.pdf')
    statMock.mockResolvedValue({ isFile: () => true, size: 2048 })
    readFileMock.mockResolvedValue(Buffer.from('%PDF-fake'))
  })

  it('匿名请求（无 Authorization 头）返回 401，且不触碰文件系统', async () => {
    const handler = await loadHandler()
    const event = makeEvent()
    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
    expect(statMock).not.toHaveBeenCalled()
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('非 Bearer 格式的 Authorization 返回 401', async () => {
    getHeaderMock.mockReturnValue('Basic abc123')
    const handler = await loadHandler()
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('无效 token（verifyToken 返回 null）返回 401', async () => {
    getHeaderMock.mockReturnValue('Bearer invalid-token')
    verifyTokenMock.mockReturnValue(null)
    const handler = await loadHandler()
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 401 })
    expect(statMock).not.toHaveBeenCalled()
  })

  it('有效 token（查看者等任意已登录角色）可读取文件内容', async () => {
    getHeaderMock.mockReturnValue('Bearer valid-token')
    verifyTokenMock.mockReturnValue({ userId: 3, username: 'viewer', role: '查看者' })
    const handler = await loadHandler()
    const result = await handler(makeEvent())
    expect(result).toEqual(Buffer.from('%PDF-fake'))
    expect(statMock).toHaveBeenCalledTimes(1)
    expect(readFileMock).toHaveBeenCalledTimes(1)
    expect(setHeaderMock).toHaveBeenCalled()
  })

  it('登录用户访问不存在的文件返回 404（原行为不回归）', async () => {
    getHeaderMock.mockReturnValue('Bearer valid-token')
    verifyTokenMock.mockReturnValue({ userId: 1, username: 'admin', role: '管理员' })
    statMock.mockResolvedValue(null)
    const handler = await loadHandler()
    await expect(handler(makeEvent())).rejects.toMatchObject({ statusCode: 404 })
  })
})
