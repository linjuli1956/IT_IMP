// @vitest-environment happy-dom
/**
 * 带鉴权文件预览/下载工具 单元测试
 *
 * 覆盖验收清单：
 * - window.open（预开空白窗口）必须发生在异步 fetch 之前（保住用户手势）
 * - fetch 失败：关闭预开窗口并抛出原始错误
 * - token 只走 Authorization 头，不进 URL（预开窗口打开的是 about:blank）
 * - 成功后预开窗口导航至 blob: ObjectURL，延迟回收
 * - 弹窗被拦截（window.open 返回 null）：提示且不抛错
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), error: vi.fn() },
}))

import { ElMessage } from 'element-plus'
import { openFilePreview, downloadFile } from './file-download'

/** 记录调用顺序，用于断言 open 先于 fetch */
const callOrder: string[] = []
const fakeWin = {
  close: vi.fn(),
  location: { href: 'about:blank' },
  opener: { mark: 'original-opener' } as unknown,
}
const createdUrls: string[] = []
const revokedUrls: string[] = []

beforeEach(() => {
  vi.clearAllMocks()
  callOrder.length = 0
  createdUrls.length = 0
  revokedUrls.length = 0
  localStorage.setItem('token', 'test-token')

  window.open = vi.fn(() => {
    callOrder.push('open')
    return fakeWin as unknown as Window
  })
  vi.stubGlobal('fetch', vi.fn(async () => {
    callOrder.push('fetch')
    return { ok: true, status: 200, blob: async () => new Blob(['%PDF-fake']) } as unknown as Response
  }))
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:http://origin/${createdUrls.length}`
    createdUrls.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => { revokedUrls.push(url) })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('openFilePreview（预开窗口模式）', () => {
  it('window.open 发生在异步 fetch 之前（同步阶段预开空白窗口）', async () => {
    await openFilePreview('/files/contracts/a.pdf')
    expect(callOrder).toEqual(['open', 'fetch'])
    // 预开的是 about:blank，不是文件地址（地址在 fetch 成功后才导航）
    expect(window.open).toHaveBeenCalledWith('about:blank', '_blank')
  })

  it('成功：预开窗口导航至 blob: ObjectURL，opener 已断开，延迟回收', async () => {
    vi.useFakeTimers()
    await openFilePreview('/files/invoices/b.pdf')
    expect(fakeWin.location.href).toMatch(/^blob:/)
    expect(fakeWin.opener).toBeNull()
    // 60 秒后回收 ObjectURL
    expect(revokedUrls).toHaveLength(0)
    vi.advanceTimersByTime(60_000)
    expect(revokedUrls).toEqual(createdUrls)
  })

  it('请求带 Authorization 头，token 不出现在任何 URL 中', async () => {
    await openFilePreview('/files/contracts/a.pdf')
    const [input, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(input).toBe('/files/contracts/a.pdf')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
    // 预开窗口与导航地址均不含 token
    expect(window.open.mock.calls[0].join(' ')).not.toContain('test-token')
    expect(fakeWin.location.href).not.toContain('test-token')
  })

  it('fetch 失败：关闭预开窗口并抛出原始错误', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      callOrder.push('fetch')
      return { ok: false, status: 401, blob: async () => new Blob() } as unknown as Response
    }))
    await expect(openFilePreview('/files/contracts/a.pdf'))
      .rejects.toThrow('未登录或登录已过期')
    expect(fakeWin.close).toHaveBeenCalledTimes(1)
    // 失败路径不创建 ObjectURL
    expect(createdUrls).toHaveLength(0)
  })

  it('网络异常（fetch 抛错）：同样关闭预开窗口并向上抛出', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      callOrder.push('fetch')
      throw new TypeError('network down')
    }))
    await expect(openFilePreview('/files/invoices/b.pdf')).rejects.toThrow('network down')
    expect(fakeWin.close).toHaveBeenCalledTimes(1)
  })

  it('弹窗被拦截（window.open 返回 null）：提示且不发起 fetch', async () => {
    window.open = vi.fn(() => null)
    await openFilePreview('/files/contracts/a.pdf')
    expect(ElMessage.warning).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('downloadFile（Blob → a[download]）', () => {
  it('成功下载：带 Authorization 取 Blob，回收 ObjectURL，不弹新窗口', async () => {
    await downloadFile('/files/invoices/b.pdf', '发票.pdf')
    expect(callOrder).toEqual(['fetch'])
    const [input, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(input).toBe('/files/invoices/b.pdf')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
    expect(window.open).not.toHaveBeenCalled()
    expect(revokedUrls).toEqual(createdUrls)
  })
})
