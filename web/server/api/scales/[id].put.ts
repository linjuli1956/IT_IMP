/**
 * 编辑电子称 API
 * PUT /api/scales/:id
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'
import { validateScaleFields, mapScaleApiError, serializeScale } from '../../utils/scale-dto'
import type { Prisma } from '../../../generated/prisma/client'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validateScaleFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  try {
    const scale = await prisma.$transaction(async (tx) => {
      const updated = await tx.scale.update({
        where: { id },
        data: data as Prisma.ScaleUncheckedUpdateInput,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '编辑',
          module: '电子称管理',
          content: `编辑电子称「${updated.assetNo || updated.model || '#' + updated.id}」（门店：${updated.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return updated
    })
    return serializeScale(scale)
  } catch (error: any) {
    const mapped = mapScaleApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
