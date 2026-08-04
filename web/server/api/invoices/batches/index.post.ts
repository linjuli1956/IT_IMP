/**
 * 创建发票批次 API
 * POST /api/invoices/batches
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { carrier, feeMonth, store }
 * 成功返回: 创建的批次记录（含自动生成的批次号）
 *
 * 批次号格式：{年月}{运营商缩写}{2位序号}，如 202606DX01
 */
import { prisma } from '../../../utils/prisma'
import { requireRole, getClientIp } from '../../../utils/auth'
import { readBody, createError, type H3Event } from 'h3'

/** 运营商缩写映射 */
const carrierAbbr: Record<string, string> = {
  '中国电信': 'DX',
  '中国联通': 'LT',
  '中国移动': 'YD',
  '广西广电': 'GD',
}

/** 运营商白名单 */
const validCarriers = ['中国电信', '中国联通', '中国移动', '广西广电']

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  const body = await readBody(event)
  const { carrier, feeMonth, store } = body

  // 参数校验
  if (!carrier || !validCarriers.includes(carrier)) {
    throw createError({ statusCode: 400, message: '无效的运营商' })
  }
  if (!feeMonth || !/^\d{4}-\d{2}$/.test(feeMonth)) {
    throw createError({ statusCode: 400, message: '无效的费用月格式，需为 YYYY-MM' })
  }
  if (!store || typeof store !== 'string') {
    throw createError({ statusCode: 400, message: '请选择门店/机构' })
  }

  // 生成批次号：{年月}{运营商缩写}{2位序号}
  const monthStr = feeMonth.replace('-', '')
  const abbr = carrierAbbr[carrier] || 'XX'

  // 查找同月同运营商的已有批次，计算下一个序号
  const existingBatches = await prisma.invoiceBatch.findMany({
    where: {
      batchNo: { startsWith: `${monthStr}${abbr}` },
    },
    select: { batchNo: true },
  })

  let maxSeq = 0
  for (const b of existingBatches) {
    const seqStr = b.batchNo.slice(-2)
    const seq = parseInt(seqStr, 10)
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq
  }
  const nextSeq = String(maxSeq + 1).padStart(2, '0')
  const batchNo = `${monthStr}${abbr}${nextSeq}`

  // 创建批次记录
  const batch = await prisma.invoiceBatch.create({
    data: {
      batchNo,
      carrier,
      feeMonth,
      store,
      invoiceCount: 0,
      totalAmount: 0,
      status: 'pending',
    },
  })

  // 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '发票管理',
      content: `创建发票批次「${batchNo}」`,
      ip: getClientIp(event),
    },
  })

  // 序列化返回
  return {
    ...batch,
    totalAmount: Number(batch.totalAmount),
    createTime: formatDate(batch.createTime),
    invoices: [],
  }
})

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}
