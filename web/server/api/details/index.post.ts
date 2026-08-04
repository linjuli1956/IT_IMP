/**
 * 上传明细表 API
 * POST /api/details
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: multipart/form-data { file, carrier, feeMonth }
 * 成功返回: 创建的 DetailTable 记录
 *
 * 文件上传逻辑：
 * 1. readMultipartFormData(event) 获取文件
 * 2. 用 xlsx 库解析 Sheet 数据
 * 3. 保存原始文件到 data/uploads/details/{carrier}_{feeMonth}_{timestamp}.xlsx
 * 4. 解析结果存 sheets JSON 字段
 * 5. filePath 存相对路径
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readMultipartFormData, createError, type H3Event } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, basename } from 'path'
import * as XLSX from 'xlsx'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 序列化明细表记录（Decimal → number, Date → string） */
function serializeDetail(d: any) {
  return {
    ...d,
    totalAmount: Number(d.totalAmount),
    uploadTime: formatDate(d.uploadTime),
    sheets: d.sheets,
  }
}

/**
 * 解析 XLS 文件，提取多 Sheet 明细数据
 * 动态识别表头行，按列名映射字段，兼容不同运营商的 XLS 格式
 */
function parseDetailXls(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets: any[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) continue
    // header: 1 → 返回数组的数组（每行为一个数组）
    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, blankrows: false })

    // 查找表头行：包含“业务号码”或“应收合计”的行
    let headerRowIdx = -1
    const colMap: Record<string, number> = {}
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue
      const cells = row.map(c => String(c || '').trim())
      if (cells.includes('业务号码') || cells.includes('应收合计')) {
        headerRowIdx = i
        for (let j = 0; j < row.length; j++) {
          const header = String(row[j] || '').trim()
          if (header) colMap[header] = j
        }
        break
      }
    }

    // 表头未找到时，使用默认列顺序（旧格式兼容）
    if (headerRowIdx === -1) {
      headerRowIdx = 0
    }

    // 列索引查找：支持多种列名
    const idxNumber = colMap['业务号码'] ?? colMap['号码'] ?? 0
    const idxMonthlyFee = colMap['月基本费'] ?? colMap['月租'] ?? -1
    const idxVoiceFee = colMap['语音通信费'] ?? colMap['语音'] ?? -1
    const idxSmsFee = colMap['短信彩信费'] ?? colMap['短信'] ?? -1
    const idxInfoFee = colMap['综合信息服务费'] ?? colMap['信息服务费'] ?? -1
    const idxDiscountFee = colMap['优惠费用'] ?? colMap['优惠'] ?? -1
    const idxTotalFee = colMap['应收合计'] ?? colMap['合计'] ?? colMap['总额'] ?? -1

    const detailRows: any[] = []
    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i]
      if (!row) continue

      const firstCell = String(row[idxNumber] || '').trim()
      // 只保留号码行：第一列必须为纯数字或含横杠的号码格式
      if (!/^[\d\-]+$/.test(firstCell)) continue

      // totalFee：优先用“应收合计”列，找不到则取最后一列数值
      let totalFee = 0
      if (idxTotalFee >= 0) {
        totalFee = Number(row[idxTotalFee]) || 0
      } else {
        for (let j = row.length - 1; j >= 0; j--) {
          const val = Number(row[j])
          if (!isNaN(val)) { totalFee = val; break }
        }
      }

      detailRows.push({
        number: String(row[idxNumber] || ''),
        monthlyFee: idxMonthlyFee >= 0 ? Number(row[idxMonthlyFee]) || 0 : 0,
        voiceFee: idxVoiceFee >= 0 ? Number(row[idxVoiceFee]) || 0 : 0,
        smsFee: idxSmsFee >= 0 ? Number(row[idxSmsFee]) || 0 : 0,
        infoFee: idxInfoFee >= 0 ? Number(row[idxInfoFee]) || 0 : 0,
        discountFee: idxDiscountFee >= 0 ? Number(row[idxDiscountFee]) || 0 : 0,
        totalFee,
      })
    }

    const totalAmount = detailRows.reduce((sum, r) => sum + r.totalFee, 0)

    sheets.push({
      sheetName,
      store: sheetName,
      rows: detailRows,
      totalAmount,
      totalNumbers: detailRows.length,
    })
  }

  return sheets
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  // 1. 获取 multipart 表单数据
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: '未收到表单数据' })
  }

  const filePart = formData.find(part => part.name === 'file')
  const carrierPart = formData.find(part => part.name === 'carrier')
  const feeMonthPart = formData.find(part => part.name === 'feeMonth')

  if (!filePart || !filePart.data) {
    throw createError({ statusCode: 400, message: '请选择要上传的文件' })
  }
  if (!carrierPart) {
    throw createError({ statusCode: 400, message: '请选择运营商' })
  }
  if (!feeMonthPart) {
    throw createError({ statusCode: 400, message: '请选择费用月' })
  }

  const carrier = carrierPart.data.toString('utf-8')
  const feeMonth = feeMonthPart.data.toString('utf-8')
  const fileName = filePart.filename || '未命名.xls'
  const fileBuffer = filePart.data

  // 安全校验：运营商白名单（防止路径穿越）
  const validCarriers = ['中国电信', '中国联通', '中国移动', '广西广电']
  if (!validCarriers.includes(carrier)) {
    throw createError({ statusCode: 400, message: '无效的运营商' })
  }

  // 安全校验：费用月格式必须为 YYYY-MM（防止路径穿越）
  if (!/^\d{4}-\d{2}$/.test(feeMonth)) {
    throw createError({ statusCode: 400, message: '无效的费用月格式' })
  }

  // 2. 解析 XLS 文件
  let sheets: any[]
  try {
    sheets = parseDetailXls(fileBuffer)
  } catch (err) {
    throw createError({ statusCode: 400, message: 'XLS 文件解析失败，请检查文件格式' })
  }

  if (sheets.length === 0) {
    throw createError({ statusCode: 400, message: '文件中未找到有效的 Sheet 数据' })
  }

  // 3. 保存原始文件到 data/uploads/details/
  const timestamp = Date.now()
  const ext = fileName.split('.').pop()?.toLowerCase() || 'xlsx'
  const savedFileName = `${carrier}_${feeMonth}_${timestamp}.${ext}`
  // basename 兜底过滤，确保文件名不含路径分隔符
  const safeFileName = basename(savedFileName)
  const uploadDir = resolve(process.cwd(), '..', 'data', 'uploads', 'details')
  await mkdir(uploadDir, { recursive: true })
  await writeFile(resolve(uploadDir, safeFileName), fileBuffer)

  // 4. 存库
  const totalNumbers = sheets.reduce((sum, s) => sum + s.totalNumbers, 0)
  const totalAmount = sheets.reduce((sum, s) => sum + s.totalAmount, 0)

  const detail = await prisma.detailTable.create({
    data: {
      carrier,
      feeMonth,
      fileName,
      filePath: `uploads/details/${safeFileName}`,
      sheetCount: sheets.length,
      totalNumbers,
      totalAmount,
      sheets: sheets as any,
    },
  })

  // 5. 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '明细表管理',
      content: `上传明细表「${carrier}_${feeMonth}」`,
      ip: getClientIp(event),
    },
  })

  return serializeDetail(detail)
})
