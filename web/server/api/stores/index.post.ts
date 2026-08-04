/**
 * 新增门店 API
 * POST /api/stores
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { name, code?, sort? }
 * 必填: name
 * 默认值: code='', sort=最大sort+1, status=1
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { name, code, sort } = body

  if (!name) {
    throw createError({ statusCode: 400, message: '门店名称不能为空' })
  }

  // 计算默认 sort
  const maxSort = await prisma.store.aggregate({ _max: { sort: true } })
  const newSort = sort ?? (maxSort._max.sort ?? 0) + 1

  const store = await prisma.store.create({
    data: { name, code: code || '', sort: newSort, status: 1 },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '基础配置',
      content: `新增门店「${name}」`,
      ip: getClientIp(event),
    },
  })

  return store
})
