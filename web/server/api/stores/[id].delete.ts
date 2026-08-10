/**
 * 删除门店 API
 * DELETE /api/stores/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 */
import { prisma } from '../../utils/prisma'
import { parsePositiveSafeId } from '../../utils/request-validation'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  try {
    // 交互式事务：删除后取真实对象写日志（门店名），日志失败整体回滚
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.store.delete({ where: { id } })
      await tx.operationLog.create({
        data: {
          userId: user.userId,
          username: user.username,
          action: '删除',
          module: '基础配置',
          content: `删除门店「${deleted.name}」`,
          ip: getClientIp(event),
        },
      })
    })
    return { success: true }
  } catch (error: any) {
    if (error?.code === 'P2025') {
      throw createError({ statusCode: 404, message: '门店不存在' })
    }
    if (error?.code === 'P2003') {
      // 并行统计四类设备引用数量（网络设备/固话/电脑/电子称）
      const [networkCount, phoneCount, computerCount, scaleCount] = await Promise.all([
        prisma.networkDevice.count({ where: { storeId: id } }),
        prisma.phone.count({ where: { storeId: id } }),
        prisma.computer.count({ where: { storeId: id } }),
        prisma.scale.count({ where: { storeId: id } }),
      ])
      const total = networkCount + phoneCount + computerCount + scaleCount
      const parts: string[] = []
      if (networkCount) parts.push(`网络设备${networkCount}`)
      if (phoneCount) parts.push(`固话${phoneCount}`)
      if (computerCount) parts.push(`电脑${computerCount}`)
      if (scaleCount) parts.push(`电子称${scaleCount}`)
      throw createError({
        statusCode: 409,
        message: `该门店仍被 ${total} 台设备引用（${parts.join('、')}），无法删除，请先移除关联数据`,
      })
    }
    throw error
  }
})
