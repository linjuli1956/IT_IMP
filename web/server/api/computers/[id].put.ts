/**
 * 编辑电脑 API
 * PUT /api/computers/:id
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'
import { validateComputerFields, mapComputerApiError, serializeComputer } from '../../utils/computer-dto'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validateComputerFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  try {
    const computer = await prisma.$transaction(async (tx) => {
      const updated = await tx.computer.update({
        where: { id },
        data,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '编辑',
          module: '电脑管理',
          content: `编辑电脑「${updated.assetNo || updated.model || '#' + updated.id}」（门店：${updated.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return updated
    })
    return serializeComputer(computer)
  } catch (error: any) {
    const mapped = mapComputerApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
