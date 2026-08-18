/**
 * 新增域名 API
 * POST /api/domains
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { domain, mainAccount, mainPassword, certType?, certIssuer?, certRenewDate?, certExpireDate?, remark?, status? }
 * 必填: domain, mainAccount, mainPassword
 * 成功返回: Domain DTO（不含 mainPassword）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toDomainDto } from '../../utils/sensitive-dto'
import { ensurePlainObjectBody, requireStringField, optionalStringField } from '../../utils/request-validation'
import { readBody, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = ensurePlainObjectBody(await readBody(event))
  const domain = requireStringField(body, 'domain', '域名')
  const mainAccount = requireStringField(body, 'mainAccount', '主账号')
  const mainPassword = requireStringField(body, 'mainPassword', '主账号密码')

  const record = await prisma.domain.create({
    data: {
      domain,
      mainAccount,
      mainPassword,
      certType: optionalStringField(body, 'certType', '证书类型') || '',
      certIssuer: optionalStringField(body, 'certIssuer', '证书颁发机构') || '',
      certRenewDate: optionalStringField(body, 'certRenewDate', '证书生效日期') || '',
      certExpireDate: optionalStringField(body, 'certExpireDate', '证书到期日期') || '',
      remark: optionalStringField(body, 'remark', '备注') || '',
      status: optionalStringField(body, 'status', '状态') || '正常',
    },
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: 'IT资产管理',
      content: `新增域名「${domain}」`,
      ip: getClientIp(event),
    },
  })

  return toDomainDto(record)
})
