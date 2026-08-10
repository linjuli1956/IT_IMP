/**
 * 删除固话 API
 * DELETE /api/phones/:id
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'
import { parsePositiveSafeId } from '../../utils/request-validation'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.phone.delete({ where: { id } })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '删除',
          module: '固话管理',
          content: `删除固话「${deleted.phoneNumber}」`,
          ip: getClientIp(event),
        },
      })
    })
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw createError({ statusCode: 404, message: '固话记录不存在' })
    }
    if (error?.code === 'P2003') {
      throw createError({ statusCode: 409, message: '该固话仍被其他数据引用，无法删除' })
    }
    throw error
  }
})
