/**
 * 发票文件上传 API（集成 OCR 识别）
 * POST /api/invoices/upload
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: multipart/form-data
 *   - batchId: 批次ID
 *   - files: PDF/ZIP 文件（支持多个）
 * 成功返回: { invoices: Invoice[], batch: Batch }
 *
 * OCR 流程：
 * - 保存 PDF 文件后，调用 extractPdfText → extractInvoiceFields
 * - Invoice 记录设 status: 'ocr-pending'
 * - invoiceNumber/invoiceDate/sellerName 写入独立列
 * - ocrResult JSON 填充完整 OCR 数据
 * - OCR 失败时 status: 'ocr-failed'，ocrResult.error 填写失败原因
 * - ZIP 文件：解压后逐个 PDF 运行 OCR
 *
 * 安全措施：
 * - path.basename() 过滤所有用户输入的文件名
 * - 运营商白名单校验（通过批次记录关联验证）
 * - 文件大小限制：PDF 10MB / ZIP 50MB
 * - ZIP 中仅提取 .pdf 文件
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readMultipartFormData, createError, type H3Event } from 'h3'
import { writeFile, mkdir } from 'fs/promises'
import { resolve, basename } from 'path'
import JSZip from 'jszip'
import { extractPdfText } from '../../utils/pdf-parser'
import { extractInvoiceFields, type ExtractedInvoice } from '../../utils/invoice-extractor'

/** 文件大小限制 */
const MAX_PDF_SIZE = 10 * 1024 * 1024  // 10MB
const MAX_ZIP_SIZE = 50 * 1024 * 1024  // 50MB

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

/** 序列化发票记录 */
function serializeInvoice(inv: any) {
  return {
    ...inv,
    amount: Number(inv.amount),
    uploadTime: formatDate(inv.uploadTime),
    stores: inv.stores,
    ocrResult: inv.ocrResult,
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    sellerName: inv.sellerName,
  }
}

/**
 * 对单个 PDF 文件执行 OCR 提取
 * @returns { extracted, rawText, error }
 */
async function ocrPdfFile(fileBuffer: Buffer): Promise<{ extracted: ExtractedInvoice | null; rawText: string; error: string | null }> {
  try {
    const rawText = await extractPdfText(fileBuffer)
    if (!rawText.trim()) {
      return { extracted: null, rawText: '', error: 'PDF 文本内容为空，可能是扫描件或图片格式' }
    }
    const extracted = extractInvoiceFields(rawText)
    return { extracted, rawText, error: null }
  } catch (err: any) {
    return { extracted: null, rawText: '', error: err?.message || 'PDF 解析失败' }
  }
}

/**
 * 构建 OCR 结果 JSON
 */
function buildOcrResult(extracted: ExtractedInvoice | null, rawText: string, error: string | null) {
  if (error) {
    return {
      invoiceNumber: '',
      invoiceDate: '',
      sellerName: '',
      buyerName: '',
      amount: 0,
      amountSource: '未识别' as const,
      taxAmount: 0,
      totalAmount: 0,
      confidence: 0,
      rawText: '',
      error,
    }
  }
  if (!extracted) {
    return {
      invoiceNumber: '',
      invoiceDate: '',
      sellerName: '',
      buyerName: '',
      amount: 0,
      amountSource: '未识别' as const,
      taxAmount: 0,
      totalAmount: 0,
      confidence: 0,
      rawText: '',
      error: '未知错误',
    }
  }
  return {
    invoiceNumber: extracted.invoiceNumber,
    invoiceDate: extracted.invoiceDate,
    sellerName: extracted.sellerName,
    buyerName: extracted.buyerName,
    amount: extracted.amount,
    amountSource: extracted.amountSource,
    taxAmount: extracted.taxAmount,
    totalAmount: extracted.totalAmount,
    confidence: extracted.confidence,
    rawText,
  }
}

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')

  // 1. 获取 multipart 表单数据
  const formData = await readMultipartFormData(event)
  if (!formData) {
    throw createError({ statusCode: 400, message: '未收到表单数据' })
  }

  // 解析 batchId
  const batchIdPart = formData.find(part => part.name === 'batchId')
  if (!batchIdPart) {
    throw createError({ statusCode: 400, message: '缺少批次ID' })
  }
  const batchId = Number(batchIdPart.data.toString('utf-8'))
  if (!batchId || isNaN(batchId)) {
    throw createError({ statusCode: 400, message: '无效的批次ID' })
  }

  // 获取所有文件 parts
  const fileParts = formData.filter(part => part.name === 'files' && part.data)
  if (fileParts.length === 0) {
    throw createError({ statusCode: 400, message: '请选择要上传的文件' })
  }

  // 2. 查找批次记录
  const batch = await prisma.invoiceBatch.findUnique({ where: { id: batchId } })
  if (!batch) {
    throw createError({ statusCode: 404, message: '批次不存在' })
  }

  // 3. 创建存储目录
  const uploadDir = resolve(process.cwd(), '..', 'data', 'uploads', 'invoices', batch.batchNo)
  await mkdir(uploadDir, { recursive: true })

  // 4. 逐个处理文件
  const createdInvoices: any[] = []
  const timestamp = Date.now()

  for (let i = 0; i < fileParts.length; i++) {
    const filePart = fileParts[i]!
    const originalName = filePart.filename || `file_${i + 1}`
    const fileBuffer = filePart.data
    const ext = originalName.split('.').pop()?.toLowerCase() || ''

    if (ext === 'pdf') {
      // PDF 文件
      if (fileBuffer.length > MAX_PDF_SIZE) {
        throw createError({ statusCode: 400, message: `PDF 文件「${originalName}」超过 10MB 限制` })
      }

      // 安全文件名：basename 过滤 + 时间戳防冲突
      const safeName = basename(originalName).replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
      const savedName = `${timestamp}_${i}_${safeName}`
      const savedPath = resolve(uploadDir, savedName)
      await writeFile(savedPath, fileBuffer)

      // OCR 提取
      const { extracted, rawText, error } = await ocrPdfFile(fileBuffer)
      const ocrResult = buildOcrResult(extracted, rawText, error)
      const isOcrFailed = !!error || !extracted
      const amount = extracted?.amount || 0
      const invoiceNumber = extracted?.invoiceNumber || ''
      const invoiceDate = extracted?.invoiceDate || ''
      const sellerName = extracted?.sellerName || ''

      // 生成展示文件名
      const displayName = `${batch.carrier}_${batch.feeMonth}_${createdInvoices.length + 1}_${amount.toFixed(2)}.pdf`

      const invoice = await prisma.invoice.create({
        data: {
          batchId,
          name: displayName,
          carrier: batch.carrier,
          feeMonth: batch.feeMonth,
          stores: [] as any,
          amount,
          status: isOcrFailed ? 'ocr-failed' : 'ocr-pending',
          filePath: `/files/uploads/invoices/${batch.batchNo}/${savedName}`,
          invoiceNumber,
          invoiceDate,
          sellerName,
          ocrResult: ocrResult as any,
        },
      })
      createdInvoices.push(invoice)

    } else if (ext === 'zip') {
      // ZIP 文件
      if (fileBuffer.length > MAX_ZIP_SIZE) {
        throw createError({ statusCode: 400, message: `ZIP 文件「${originalName}」超过 50MB 限制` })
      }

      // 用 jszip 解压
      let zip: JSZip
      try {
        zip = await JSZip.loadAsync(fileBuffer)
      } catch {
        throw createError({ statusCode: 400, message: `ZIP 文件「${originalName}」解压失败` })
      }

      // 收集 ZIP 中的 PDF 文件
      const pdfEntries: { name: string; data: Buffer }[] = []
      for (const [path, entry] of Object.entries(zip.files)) {
        if (entry.dir) continue
        const entryExt = path.split('.').pop()?.toLowerCase() || ''
        if (entryExt !== 'pdf') continue

        try {
          const pdfData = await entry.async('nodebuffer')
          if (pdfData.length > MAX_PDF_SIZE) {
            throw createError({ statusCode: 400, message: `ZIP 内文件「${path}」超过 10MB 限制` })
          }
          // basename 安全过滤
          const entryBaseName = basename(path)
          pdfEntries.push({ name: entryBaseName, data: pdfData })
        } catch (err) {
          // 跳过无法读取的文件
          continue
        }
      }

      if (pdfEntries.length === 0) {
        throw createError({ statusCode: 400, message: `ZIP 文件「${originalName}」中未找到 PDF 文件` })
      }

      for (let j = 0; j < pdfEntries.length; j++) {
        const pdfEntry = pdfEntries[j]!
        const safeName = pdfEntry.name.replace(/[^\w.\-\u4e00-\u9fa5]/g, '_')
        const savedName = `${timestamp}_${i}_${j}_${safeName}`
        const savedPath = resolve(uploadDir, savedName)
        await writeFile(savedPath, pdfEntry.data)

        // OCR 提取
        const { extracted, rawText, error } = await ocrPdfFile(pdfEntry.data)
        const ocrResult = buildOcrResult(extracted, rawText, error)
        const isOcrFailed = !!error || !extracted
        const amount = extracted?.amount || 0
        const invoiceNumber = extracted?.invoiceNumber || ''
        const invoiceDate = extracted?.invoiceDate || ''
        const sellerName = extracted?.sellerName || ''

        const displayName = `${batch.carrier}_${batch.feeMonth}_${createdInvoices.length + 1}_${amount.toFixed(2)}.pdf`

        const invoice = await prisma.invoice.create({
          data: {
            batchId,
            name: displayName,
            carrier: batch.carrier,
            feeMonth: batch.feeMonth,
            stores: [] as any,
            amount,
            status: isOcrFailed ? 'ocr-failed' : 'ocr-pending',
            filePath: `/files/uploads/invoices/${batch.batchNo}/${savedName}`,
            invoiceNumber,
            invoiceDate,
            sellerName,
            ocrResult: ocrResult as any,
          },
        })
        createdInvoices.push(invoice)
      }

    } else {
      throw createError({ statusCode: 400, message: `不支持的文件类型「${originalName}」，仅支持 PDF 和 ZIP` })
    }
  }

  // 5. 更新批次统计
  const allInvoices = await prisma.invoice.findMany({
    where: { batchId },
    select: { amount: true },
  })
  const totalCount = allInvoices.length
  const totalAmount = allInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

  const updatedBatch = await prisma.invoiceBatch.update({
    where: { id: batchId },
    data: {
      invoiceCount: totalCount,
      totalAmount,
    },
  })

  // 6. 记录操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: 'OCR导入',
      module: '发票管理',
      content: `OCR导入发票至批次「${batch.batchNo}」(${createdInvoices.length}张)`,
      ip: getClientIp(event),
    },
  })

  // 7. 返回结果
  return {
    invoices: createdInvoices.map(serializeInvoice),
    batch: {
      ...updatedBatch,
      totalAmount: Number(updatedBatch.totalAmount),
      createTime: formatDate(updatedBatch.createTime),
    },
  }
})
