/**
 * 电子称详情 API
 * GET /api/scales/:id
 */
import { prisma } from '../../utils/prisma'
import { serializeScale } from '../../utils/scale-dto'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const scale = await prisma.scale.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true } } },
  })
  if (!scale) {
    throw createError({ statusCode: 404, message: '电子称记录不存在' })
  }
  return serializeScale(scale)
})
