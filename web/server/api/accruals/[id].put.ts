/**
 * 更新计提表 API
 * PUT /api/accruals/:id
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体模式1: { status: 'printed' | 'generated' } — 更新状态，同步批次状态
 * 请求体模式2: { groups: AccrualGroup[] } — 编辑计提表内容（重新计算小计/合计/报销说明）
 * 请求体模式3: { status, groups } — 同时更新
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, getRouterParam, createError, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

// 报销说明生成：共享实现，定义在 app/utils/reimbursement.ts
import { generateReimbursementText } from '../../../app/utils/reimbursement'

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const id = Number(getRouterParam(event, 'id'))

  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: '无效的计提表ID' })
  }

  const body = await readBody(event)
  const { status, groups } = body

  // 查询现有计提表（需要 feeMonth/carrier 用于报销说明重算）
  const existing = await prisma.accrual.findUnique({ where: { id } })
  if (!existing) {
    throw createError({ statusCode: 404, message: '计提表不存在' })
  }

  const data: Record<string, any> = {}

  // 模式1/3：更新状态
  if (status !== undefined) {
    if (!['printed', 'generated'].includes(status)) {
      throw createError({ statusCode: 400, message: '无效的状态，仅支持 printed 或 generated' })
    }
    data.status = status

    // 同步更新批次状态
    const batchStatus = status === 'printed' ? 'printed' : 'accrued'
    await prisma.invoiceBatch.update({
      where: { id: existing.batchId },
      data: { status: batchStatus },
    })
  }

  // 模式2/3：编辑 groups
  let logContent = ''
  if (groups !== undefined && Array.isArray(groups)) {
    // 基本数据校验
    for (const g of groups) {
      if (!g || typeof g.store !== 'string' || !g.store) {
        throw createError({ statusCode: 400, message: '分组数据无效：缺少 store 字段' })
      }
      if (!Array.isArray(g.rows)) {
        throw createError({ statusCode: 400, message: `分组「${g.store}」缺少 rows 数组` })
      }
      for (const r of g.rows) {
        if (!Array.isArray(r.dept)) {
          throw createError({ statusCode: 400, message: `分组「${g.store}」行数据缺少 dept 数组` })
        }
        if (typeof r.amount !== 'number' || isNaN(r.amount)) {
          throw createError({ statusCode: 400, message: `分组「${g.store}」行数据 amount 不是有效数字` })
        }
      }
    }

    // 重新计算每个 group 的 subtotal 和 reimbursementText
    for (const g of groups) {
      g.subtotal = (g.rows || []).reduce((sum: number, r: any) => sum + r.amount, 0)
      g.reimbursementText = generateReimbursementText(
        g.reimbursementFormat || '',
        g.reimbursementCustom || '',
        (g.rows || []).map((r: any) => ({ dept: r.dept, name: r.name, amount: r.amount, feeType: r.feeType })),
        g.store,
        existing.feeMonth,
        existing.carrier,
      )
    }

    // 重新计算合计
    data.totalAmount = groups.reduce((sum: number, g: any) => sum + g.subtotal, 0)
    data.groups = groups
    logContent = `编辑计提表「${existing.batchNo}」内容（合计：${Number(data.totalAmount).toFixed(2)}）`
  }

  // 更新计提表
  const accrual = await prisma.accrual.update({
    where: { id },
    data,
  })

  // 操作日志
  if (!logContent) {
    const statusText = status === 'printed' ? '已打印' : '已生成'
    logContent = `更新计提表「${existing.batchNo}」状态为${statusText}`
  }
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '编辑',
      module: '计提管理',
      content: logContent,
      ip: getClientIp(event),
    },
  })

  return {
    ...accrual,
    totalAmount: Number(accrual.totalAmount),
    createTime: formatDate(accrual.createTime),
    groups: accrual.groups,
  }
})
