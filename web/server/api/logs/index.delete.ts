/**
 * 清空操作日志 API
 * DELETE /api/logs
 */
import { prisma } from '../../utils/prisma'
import { getClientIp, requireRole } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = requireRole(event, '管理员')

  const deletedCount = await prisma.$transaction(async (transaction) => {
    const result = await transaction.operationLog.deleteMany()
    await transaction.operationLog.create({
      data: {
        userId: user.userId,
        username: user.username,
        action: '删除',
        module: '系统管理',
        content: `清空全部操作日志（共 ${result.count} 条）`,
        ip: getClientIp(event),
      },
    })
    return result.count
  })

  return { deletedCount }
})
