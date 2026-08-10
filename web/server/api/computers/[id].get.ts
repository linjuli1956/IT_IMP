/**
 * 电脑详情 API
 * GET /api/computers/:id
 */
import { prisma } from '../../utils/prisma'
import { serializeComputer } from '../../utils/computer-dto'
import { requireRole } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  requireRole(event)
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const computer = await prisma.computer.findUnique({
    where: { id },
    include: { store: { select: { id: true, name: true } } },
  })
  if (!computer) {
    throw createError({ statusCode: 404, message: '电脑记录不存在' })
  }
  return serializeComputer(computer)
})
