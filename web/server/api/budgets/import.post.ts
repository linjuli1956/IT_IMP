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
import { parseBudgetRows, isFeeRangeValid, dedupeBudgetRows, type BudgetImportRow, type BudgetImportError } from '../../utils/budget-import'

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

  // 可选：默认费用范围（模板中费用范围为空的导入时自动填充）
  const defaultFeeRangePart = formData?.find(part => part.name === 'defaultFeeRange')
  const defaultFeeRange = defaultFeeRangePart ? defaultFeeRangePart.data.toString('utf-8').trim() : ''
  if (defaultFeeRange !== '' && !isFeeRangeValid(defaultFeeRange)) {
    throw createError({ statusCode: 400, message: '默认费用范围格式应为 YYYY-MM~YYYY-MM（月份 01~12），且结束日期不能早于开始日期' })
  }

  // 2. 解析 + 校验（整批拒绝策略；损坏文件捕获为 400 而非 500）
  let rows: BudgetImportRow[]
  let errors: BudgetImportError[]
  try {
    const parsed = parseBudgetRows(filePart.data, defaultFeeRange)
    rows = parsed.rows
    errors = parsed.errors
  } catch {
    throw createError({ statusCode: 400, message: '文件无法解析，请确认是有效的 .xlsx / .xls 文件' })
  }
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

  // 4. 去重：库内已存在 + 同文件重复 的组合均跳过并计数
  const { rows: toImport, skipped } = dedupeBudgetRows(rows, existingKeys)

  // 4. 批量入库（数据库唯一约束兑底：并发导入等导致的组合冲突整体拒绝）
  let count = 0
  if (toImport.length > 0) {
    try {
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
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw createError({
          statusCode: 409,
          message: '导入数据与已有记录发生冲突（可能已被其他操作写入），本次未导入任何数据，请重新上传',
        })
      }
      throw error
    }
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
