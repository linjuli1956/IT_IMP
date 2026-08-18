/**
 * 编辑域名 API
 * PUT /api/domains/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: 全部字段（除 id 外）
 * 允许部分更新；mainPassword 为空/未提供时不更新（防止留空意外清空已保存密码）
 * 成功返回: Domain DTO（不含 mainPassword）
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { toDomainDto } from '../../utils/sensitive-dto'
import { parsePositiveSafeId, ensurePlainObjectBody, pickStringUpdateFields } from '../../utils/request-validation'
import { readBody, getRouterParam, type H3Event } from 'h3'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = parsePositiveSafeId(getRouterParam(event, 'id'))

  const body = ensurePlainObjectBody(await readBody(event))
  // 白名单挑选：未知字段/id 不落库；mainPassword 空值 = 不修改
  const data = pickStringUpdateFields(body, [
    { key: 'domain', label: '域名' },
    { key: 'mainAccount', label: '主账号' },
    { key: 'mainPassword', label: '主账号密码', sensitive: true },
    { key: 'certType', label: '证书类型' },
    { key: 'certIssuer', label: '证书颁发机构' },
    { key: 'certRenewDate', label: '证书生效日期' },
    { key: 'certExpireDate', label: '证书到期日期' },
    { key: 'remark', label: '备注' },
    { key: 'status', label: '状态' },
  ])

  const record = await prisma.domain.update({
    where: { id },
    data,
  })

  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: 'IT资产管理',
      content: `编辑域名「${record.domain}」`,
      ip: getClientIp(event),
    },
  })

  return toDomainDto(record)
})
