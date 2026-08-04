/**
 * 新增服务器 API
 * POST /api/servers
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 全部字段（除 id 外）
 * 必填: name, serverType, purpose, account, password
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { name, serverType, purpose, account, password } = body

  if (!name) {
    throw createError({ statusCode: 400, message: '服务器名称不能为空' })
  }
  if (!serverType) {
    throw createError({ statusCode: 400, message: '服务器类型不能为空' })
  }
  if (!purpose) {
    throw createError({ statusCode: 400, message: '用途说明不能为空' })
  }
  if (!account) {
    throw createError({ statusCode: 400, message: '登录账号不能为空' })
  }
  if (!password) {
    throw createError({ statusCode: 400, message: '登录密码不能为空' })
  }

  const server = await prisma.server.create({
    data: {
      name,
      serverType,
      cloudAccount: body.cloudAccount || '',
      internalIp: body.internalIp || '',
      externalIp: body.externalIp || '',
      port: body.port || '22',
      cpuModel: body.cpuModel || '',
      cpuCores: body.cpuCores || '',
      memorySize: body.memorySize || '',
      systemDiskSize: body.systemDiskSize || '',
      dataDiskSize: body.dataDiskSize || '',
      diskType: body.diskType || '',
      os: body.os || '',
      expireDate: body.expireDate || '',
      purpose,
      account,
      password,
      dbAccount: body.dbAccount || '',
      dbPassword: body.dbPassword || '',
      dbPort: body.dbPort || '',
      remark: body.remark || '',
      status: body.status || '正常',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: 'IT资产管理',
      content: `新增服务器「${name}」`,
      ip: getClientIp(event),
    },
  })

  return server
})
