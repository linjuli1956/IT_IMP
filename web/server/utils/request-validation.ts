/**
 * 请求参数校验公共工具（跨模块复用：服务器/网络设备/固话/电脑/电子称等 API）
 */
import { createError } from 'h3'

/** 路由 ID 统一校验：正安全整数，非法抛 400（避免各 API 复制判断） */
export function parsePositiveSafeId(value: unknown, label = 'ID'): number {
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({ statusCode: 400, message: `无效的${label}` })
  }
  return id
}
