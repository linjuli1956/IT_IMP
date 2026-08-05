/**
 * 预算 Excel 批量导入 API
 * POST /api/budgets/import
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: multipart/form-data { file: .xlsx / .xls（单个，≤5MB） }
 *
 * 行为：
 * - 任一数据行校验失败 → 整批拒绝（400），data.errors 返回 { row, message } 明细；
 * - 同一 财年+门店+运营商+费用类型 已存在 → 跳过该行并计数；
 * - 导入成功后记录操作日志。
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readMultipartFormData, createError, type H3Event } from 'h3'
import { parseBudgetRows, type BudgetImportRow } from '../../utils/budget-import'

/** 文件大小上限：5MB */
const MAX_FILE_SIZE = 5 * 1024 * 1024
/** 允许的扩展名（大小写不敏感） */
const ALLOWED_EXTS = ['xlsx', 'xls']

/** 校验文件名扩展名是否在允许列表内 */
function hasAllowedExt(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  return ALLOWED_EXTS.includes(ext)
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  // 1. 读取上传文件
  const formData = await readMultipartFormData(event)
  const filePart = formData?.find(part => part.name === 'file')
  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, message: '请选择要导入的 Excel 文件' })
  }

  const fileName = filePart.filename || '未命名.xlsx'
  if (!hasAllowedExt(fileName)) {
    throw createError({ statusCode: 400, message: '仅支持 .xlsx / .xls 文件' })
  }
  if (filePart.data.length > MAX_FILE_SIZE) {
    throw createError({ statusCode: 400, message: '文件大小不能超过 5MB' })
  }

  // 2. 解析 + 校验（整批拒绝策略）
  const { rows, errors } = parseBudgetRows(filePart.data)
  if (errors.length > 0) {
    throw createError({
      statusCode: 400,
      message: `导入失败：共 ${errors.length} 行填写有误，请修正后重新上传`,
      data: { errors },
    })
  }
  if (rows.length === 0) {
    throw createError({ statusCode: 400, message: '文件中没有可导入的数据行' })
  }

  // 3. 重复检测：按财年批量查询已存在的 门店+运营商+费用类型 组合
  const fiscalYears = [...new Set(rows.map(r => r.fiscalYear))]
  const existing = await prisma.budgetDetail.findMany({
    where: { fiscalYear: { in: fiscalYears } },
    select: { fiscalYear: true, storeName: true, carrier: true, feeType: true },
  })
  const existingKeys = new Set(
    existing.map(e => `${e.fiscalYear}|${e.storeName}|${e.carrier}|${e.feeType}`)
  )

  const toImport: BudgetImportRow[] = []
  let skipped = 0
  for (const row of rows) {
    const key = `${row.fiscalYear}|${row.storeName}|${row.carrier}|${row.feeType}`
    if (existingKeys.has(key)) {
      skipped++
      continue
    }
    toImport.push(row)
  }

  // 4. 批量入库
  let count = 0
  if (toImport.length > 0) {
    const result = await prisma.budgetDetail.createMany({
      data: toImport.map(item => ({
        fiscalYear: item.fiscalYear,
        storeName: item.storeName,
        carrier: item.carrier,
        feeType: item.feeType,
        monthlyFee: item.monthlyFee,
        annualFee: item.annualFee,
        feeRange: item.feeRange,
        broadbandType: item.broadbandType,
        paymentMethod: item.paymentMethod,
        remark: item.remark,
      })),
    })
    count = result.count
  }

  // 5. 操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '预算管理',
      content: `Excel 导入预算明细 ${count} 条${skipped > 0 ? `，跳过重复 ${skipped} 条` : ''}`,
      ip: getClientIp(event),
    },
  })

  return { success: true, count, skipped }
})
