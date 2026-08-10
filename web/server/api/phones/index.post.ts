/**
 * 新增固话 API
 * POST /api/phones
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 必填: storeId, phoneNumber
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'
import { validatePhoneFields, mapPhoneApiError, serializePhone } from '../../utils/phone-dto'
import type { Prisma } from '../../../generated/prisma/client'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody<Record<string, unknown>>(event)

  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, message: '请求体格式错误' })
  }

  const { data, errors } = validatePhoneFields(body)
  if (errors.length > 0) {
    throw createError({ statusCode: 400, message: errors.join('；') })
  }
  if (data.storeId === undefined) throw createError({ statusCode: 400, message: 'storeId 必填' })
  if (data.phoneNumber === undefined) throw createError({ statusCode: 400, message: 'phoneNumber 必填' })

  try {
    const phone = await prisma.$transaction(async (tx) => {
      const created = await tx.phone.create({
        data: data as Prisma.PhoneUncheckedCreateInput,
        include: { store: { select: { name: true } } },
      })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '新增',
          module: '固话管理',
          content: `新增固话「${created.phoneNumber}」（门店：${created.store?.name ?? '-'}）`,
          ip: getClientIp(event),
        },
      })
      return created
    })
    return serializePhone(phone)
  } catch (error: any) {
    const mapped = mapPhoneApiError(error)
    if (mapped) throw createError({ statusCode: mapped.statusCode, message: mapped.message })
    throw error
  }
})
