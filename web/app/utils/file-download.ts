/**
 * 带鉴权的文件预览/下载工具
 * /files/** 需登录访问：token 统一走 Authorization 头（不放 URL 参数），
 * 以 Blob + ObjectURL 替代直接 window.open('/files/...')（浏览器匿名 GET 会被 401）
 */
import { ElMessage } from 'element-plus'

/** 从 localStorage 读取 token（SSR 安全） */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

/** 带鉴权请求文件并返回 Blob */
export async function fetchFileBlob(filePath: string): Promise<Blob> {
  const token = getAuthToken()
  const res = await fetch(filePath, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    const message = res.status === 401
      ? '未登录或登录已过期，请重新登录后查看'
      : `文件请求失败（HTTP ${res.status}）`
    throw new Error(message)
  }
  return res.blob()
}

/** 新窗口预览文件（PDF 等）：Blob → ObjectURL，延迟回收 */
export async function openFilePreview(filePath: string): Promise<void> {
  const blob = await fetchFileBlob(filePath)
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank', 'noopener')
  if (!win) {
    ElMessage.warning('弹出窗口被浏览器拦截，请允许弹窗后重试')
    URL.revokeObjectURL(url)
    return
  }
  // 给新窗口加载留出时间，之后回收 ObjectURL
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** 下载文件：Blob → ObjectURL → a[download] 点击 */
export async function downloadFile(filePath: string, filename: string): Promise<void> {
  const blob = await fetchFileBlob(filePath)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
