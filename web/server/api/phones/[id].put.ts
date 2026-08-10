/**
 * 编辑固话 API
 * PUT /api/phones/:id
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, type H3Event } from 'h3'
import { validatePhoneFields, mapPhoneApiError, serializePhone } from '../../utils/phone-dto'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = await readBody<Record<string, unknown>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validatePhoneFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }

  try {
    const phone = await prisma.$transaction(async (tx) => {
      const updated = await tx.phone.update({
        where: { id },
        data,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '编辑',
          module: '固话管理',
          content: `编辑固话「${updated.phoneNumber}」（门店：${updated.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return updated
    })
    return serializePhone(phone)
  } catch (error: any) {
    const mapped = mapPhoneApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
