/**
 * 新增电子称 API
 * POST /api/scales
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'
import { validateScaleFields, mapScaleApiError, serializeScale } from '../../utils/scale-dto'
import type { Prisma } from '../../../generated/prisma/client'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validateScaleFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }
  if (data.storeId === undefined) throw createError({ statusCode: 400, message: 'storeId 必填' })

  try {
    const scale = await prisma.$transaction(async (tx) => {
      const created = await tx.scale.create({
        data: data as Prisma.ScaleUncheckedCreateInput,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '新增',
          module: '电子称管理',
          content: `新增电子称「${created.assetNo || created.model || '#' + created.id}」（门店：${created.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return created
    })
    return serializeScale(scale)
  } catch (error: any) {
    const mapped = mapScaleApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
