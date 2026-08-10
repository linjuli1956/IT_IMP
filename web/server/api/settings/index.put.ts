/**
 * 系统设置更新 API
 * PUT /api/settings
 * 请求头: Authorization: Bearer xxx (需管理员)
 * 请求体: { key: value, ... }（只更新传入的设置项，其余保持不变）
 * 校验: startMonth 必须为 1~12 的整数
 * 说明: 新增键值会按 SETTING_META 的说明自动创建；未知键拒绝更新。
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

/** 设置项元数据：描述与取值校验（新增系统参数时在此登记） */
const SETTING_META: Record<string, { description: string; validate?: (value: string) => string | null }> = {
  startMonth: {
    description: '财年起始月（1~12）：预算财年从该月算起，如 4 表示 4月~次年3月为一个财年',
    validate: (value) => {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1 || n > 12) {
        return '财年起始月需为 1~12 的整数'
      }
      return null
    },
  },
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员')

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const entries = Object.entries(body).filter(([, value]) => value !== undefined && value !== null)
  if (entries.length === 0) {
    throw createError({ statusCode: 400, message: '没有可更新的设置项' })
  }

  // 逐项校验：未知键拒绝、取值不合法拒绝（整批校验，任一失败则不写入）
  for (const [key, value] of entries) {
    const meta = SETTING_META[key]!
    if (!meta) {
      throw createError({ statusCode: 400, message: `未知的设置项: ${key}` })
    }
    const text = String(value)
    if (meta.validate) {
      const error = meta.validate(text)
      if (error) {
        throw createError({ statusCode: 400, message: `${key}: ${error}` })
      }
    }
  }

  // 批量写入（存在则更新，不存在则按元数据说明创建）
  for (const [key, value] of entries) {
    const meta = SETTING_META[key]!
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value), description: meta.description },
    })
  }

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '更新',
      module: '系统设置',
      content: `更新系统设置: ${entries.map(([key]) => key).join(', ')}`,
      ip: getClientIp(event),
    },
  })

  const settings = await prisma.appSetting.findMany()
  return Object.fromEntries(settings.map(s => [s.key, s.value]))
})
