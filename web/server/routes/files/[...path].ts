/**
 * 静态文件服务路由
 * GET /files/{path}
 * 提供 data/uploads/ 目录下的文件访问（PDF、XLSX 等）
 * 安全措施：路径穿越防护，仅允许访问 data/ 目录下的文件
 */
import { getRouterParam, createError, setHeader, type H3Event } from 'h3'
import { readFile, stat } from 'fs/promises'
import { resolve, extname } from 'path'

/** MIME 类型映射 */
const contentTypes: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export default defineEventHandler(async (event: H3Event) => {
  const pathParam = getRouterParam(event, 'path')
  if (!pathParam) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  // 安全：禁止路径穿越（去除 .. 片段）
  const sanitizedPath = pathParam.replace(/\.\./g, '').replace(/\\/g, '/')

  // 构建绝对路径（data 目录在 web 上级）
  const dataDir = resolve(process.cwd(), '..', 'data')
  const absPath = resolve(dataDir, sanitizedPath)

  // 再次验证路径在 data 目录内
  if (!absPath.startsWith(dataDir)) {
    throw createError({ statusCode: 403, message: '禁止访问' })
  }

  // 检查文件是否存在
  const stats = await stat(absPath).catch(() => null)
  if (!stats || !stats.isFile()) {
    throw createError({ statusCode: 404, message: '文件不存在' })
  }

  // 设置响应头
  const ext = extname(absPath).toLowerCase()
  setHeader(event, 'Content-Type', contentTypes[ext] || 'application/octet-stream')
  setHeader(event, 'Content-Length', stats.size)
  setHeader(event, 'Cache-Control', 'no-cache')

  return readFile(absPath)
})
