/**
 * 固话详情 API
 * GET /api/phones/:id
 */
import { prisma } from '../../utils/prisma'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { serializePhone } from '../../utils/phone-dto'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const phone = await prisma.phone.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true } } },
  })
  if (!phone) {
    throw createError({ statusCode: 404, message: '固话记录不存在' })
  }
  return serializePhone(phone)
})
