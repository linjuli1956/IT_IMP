/**
 * 删除明细表 API
 * DELETE /api/details/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 成功返回: { success: true }
 * 同时删除物理文件
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { getRouterParam, createError, type H3Event } from 'h3'
import { unlink } from 'fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的明细表ID' })
  }

  // 查找记录（获取 filePath 和 fileName 用于删除文件和日志）
  const detail = await prisma.detailTable.findUnique({ where: { id } })

  if (!detail) {
    throw createError({ statusCode: 404, message: '明细表不存在或已删除' })
  }

  // 删除 DB 记录
  await prisma.detailTable.delete({ where: { id } })

  // 删除物理文件（忽略文件不存在的错误）
  if (detail.filePath) {
    const absPath = resolve(process.cwd(), '..', 'data', detail.filePath)
    try {
      await unlink(absPath)
    } catch {
      // 文件可能已不存在，忽略错误
    }
  }

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '删除',
      module: '明细表管理',
      content: `删除明细表「${detail.fileName}」`,
      ip: getClientIp(event),
    },
  })

  return { success: true }
})
