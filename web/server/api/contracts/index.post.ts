/**
 * 新增合同 API
 * POST /api/contracts
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { title, supplierName, type, amount, signDate, expireDate, fileName?, filePath?, remark? }
 * 必填: title, supplierName, type
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { title, supplierName, type, amount, signDate, expireDate, fileName, filePath, remark } = body

  if (!title) {
    throw createError({ statusCode: 400, message: '合同标题不能为空' })
  }
  if (!supplierName) {
    throw createError({ statusCode: 400, message: '客户名称不能为空' })
  }
  if (!type) {
    throw createError({ statusCode: 400, message: '合同类型不能为空' })
  }

  const contract = await prisma.contract.create({
    data: {
      title,
      supplierName,
      type,
      amount: amount || 0,
      signDate: signDate || '',
      expireDate: expireDate || '',
      fileName: fileName || '',
      filePath: filePath || '',
      remark: remark || '',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '合同管理',
      content: `新增合同「${title}」`,
      ip: getClientIp(event),
    },
  })

  return {
    ...contract,
    amount: Number(contract.amount),
  }
})
