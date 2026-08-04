/**
 * 生成计提表 API
 * POST /api/accruals/generate
 * 请求头: Authorization: Bearer xxx (需管理员或操作员)
 * 请求体: { batchId, templateOverrides?, detailTableId?, schemeId?, manualAdjustments? }
 *   - batchId: 必填，发票批次ID
 *   - templateOverrides: 可选，{ [store: string]: number } 门店→模板ID映射
 *   - detailTableId: 可选，明细表ID（undefined=自动判断, 0=按发票, >0=按指定明细表）
 *   - schemeId: 可选，费用分摊方案ID（>0=按费用分摊模式生成）
 *   - manualAdjustments: 可选，{ [key]: number } 手动费用项金额映射
 *
 * 计提生成逻辑：
 * - 电信：按明细表生成（号码行匹配明细表取应收合计，非号码行倒推计算）
 * - 移动/联通：按发票生成（发票金额填入模板行）
 * - 多门店发票按门店数均摊金额
 */
import { prisma } from '../../utils/prisma'
import { requireRole, getClientIp } from '../../utils/auth'
import { readBody, createError, type H3Event } from 'h3'

/** 将 Date 格式化为 YYYY-MM-DD HH:mm */
function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d} ${h}:${min}`
}

// ============================================
// 类型定义（与前端 AccrualRow / AccrualGroup 一致）
// ============================================

interface AccrualRow {
  seq: number
  dept: string[]
  name: string
  amount: number
  remark: string
  source: 'detail' | 'invoice' | 'calculated' | 'preset' | 'allocation' | 'manual'
  feeType: string
}

interface AccrualGroup {
  store: string
  templateId: number
  schemeId: number
  carrier: string
  rows: AccrualRow[]
  subtotal: number
  invoiceAmount: number
  reimbursementFormat: string
  reimbursementCustom: string
  reimbursementText: string
}

// 报销说明生成：共享实现，定义在 app/utils/reimbursement.ts
import { generateReimbursementText } from '../../../app/utils/reimbursement'

// ============================================
// 模板匹配辅助函数（支持一个模板覆盖多门店）
// ============================================

/** 查找门店对应的模板：先精确匹配 store 字段，再检查 items 的 dept */
function findTemplateForStore(templates: any[], carrier: string, store: string, overrideMap: Map<string, number>): any | undefined {
  // 1. 优先使用手动指定的模板
  if (overrideMap.has(store)) {
    const tid = overrideMap.get(store)!
    const t = templates.find(t => t.id === tid)
    if (t) return t
  }
  // 2. 精确匹配 template.store
  const exact = templates.find(t => t.carrier === carrier && t.store === store)
  if (exact) return exact
  // 3. 检查 items 中是否有 dept 包含该门店
  return templates.find(t =>
    t.carrier === carrier &&
    ((t.items as any[]) || []).some(item => ((item.dept as string[]) || []).includes(store)),
  )
}

/** 过滤模板 items：按门店筛选，只返回该门店相关的行 */
function filterItemsByStore(items: any[], store: string): any[] {
  const hasMatchingDept = items.some(item => ((item.dept as string[]) || []).includes(store))
  if (!hasMatchingDept) return items
  return items.filter(item => {
    const depts = (item.dept as string[]) || []
    return depts.includes(store) || depts.length === 0
  })
}

// ============================================
// 主逻辑
// ============================================

export default defineEventHandler(async (event: H3Event) => {
  const user = requireRole(event, '管理员', '操作员')
  const body = await readBody(event)
  const { batchId, templateOverrides, detailTableId, schemeId, manualAdjustments } = body

  if (!batchId || isNaN(Number(batchId))) {
    throw createError({ statusCode: 400, message: '无效的批次ID' })
  }

  // 1. 查询批次（含发票）
  const batch = await prisma.invoiceBatch.findUnique({
    where: { id: Number(batchId) },
    include: { invoices: { orderBy: { id: 'asc' } } },
  })

  if (!batch) {
    throw createError({ statusCode: 404, message: '批次不存在或已删除' })
  }

  if (!batch.invoices || batch.invoices.length === 0) {
    throw createError({ statusCode: 400, message: '该批次没有发票，无法生成计提表' })
  }

  // 2. 检查是否已存在计提表
  const existingAccrual = await prisma.accrual.findFirst({ where: { batchId: batch.id } })
  if (existingAccrual) {
    throw createError({ statusCode: 400, message: '该批次已生成计提表，请先删除已有计提表再重新生成' })
  }

  // 3. 判断计提方式（三选一：allocation > detail > invoice）
  const useAllocationMode = Number(schemeId) > 0
  const useDetailMode = !useAllocationMode && (detailTableId === undefined
    ? batch.carrier === '中国电信'
    : Number(detailTableId) > 0)
  const method: 'detail' | 'invoice' | 'allocation' = useAllocationMode ? 'allocation' : (useDetailMode ? 'detail' : 'invoice')

  // 4. 查询明细表（如需）
  let detailTable: any = null
  if (!useAllocationMode && useDetailMode) {
    if (detailTableId !== undefined && Number(detailTableId) > 0) {
      // 使用指定明细表
      detailTable = await prisma.detailTable.findUnique({ where: { id: Number(detailTableId) } })
      if (!detailTable) {
        throw createError({ statusCode: 400, message: '指定的明细表不存在' })
      }
    } else {
      // 自动匹配同运营商+费用月的明细表
      detailTable = await prisma.detailTable.findFirst({
        where: { carrier: batch.carrier, feeMonth: batch.feeMonth },
      })
    }
  }

  // 5. 发票总额（所有模式共用）
  const totalInvoiceAmount = batch.invoices.reduce((sum, inv) => sum + Number(inv.amount), 0)

  // 6. 生成计提分组
  const groups: AccrualGroup[] = []
  let seqCounter = 0

  if (useAllocationMode) {
    // ===== allocation 模式：按费用分摊方案生成 =====
    const scheme = await prisma.feeAllocationScheme.findUnique({ where: { id: Number(schemeId) } })
    if (!scheme) {
      throw createError({ statusCode: 400, message: '指定的费用分摊方案不存在' })
    }

    const schemeItems = (scheme.items as any[]) || []
    const storeRowsMap = new Map<string, AccrualRow[]>()

    for (const item of schemeItems) {
      // a. 确定金额（manual 时 itemAmount 保持 0，由 manualAdjustments 提供各门店金额）
      let itemAmount = 0
      if (item.amountSource === 'fixed') {
        itemAmount = Number(item.fixedAmount) || 0
      } else if (item.amountSource === 'invoice') {
        itemAmount = totalInvoiceAmount
      }

      // b. 按分摊方式计算各门店金额
      // safeguard: amountSource='manual' 时强制使用 manual 分摊方式，避免 ratio/quantity 产生 0 值
      const effectiveAllocationMode = item.amountSource === 'manual' ? 'manual' : item.allocationMode
      const allocations = (item.allocations as any[]) || []
      const sumValues = allocations.reduce((s, a) => s + (Number(a.value) || 0), 0)

      for (const alloc of allocations) {
        let storeAmount = 0
        switch (effectiveAllocationMode) {
          case 'fixed':
            storeAmount = Number(alloc.value) || 0
            break
          case 'ratio':
            storeAmount = itemAmount * (Number(alloc.value) || 0) / 100
            break
          case 'quantity':
            storeAmount = sumValues > 0 ? itemAmount * (Number(alloc.value) || 0) / sumValues : 0
            break
          case 'manual': {
            const key = `${item.name}::${alloc.store}`
            storeAmount = Number(manualAdjustments?.[key] ?? manualAdjustments?.[alloc.store] ?? 0)
            break
          }
        }

        if (!storeRowsMap.has(alloc.store)) {
          storeRowsMap.set(alloc.store, [])
        }
        storeRowsMap.get(alloc.store)!.push({
          seq: 0,
          dept: [...(alloc.dept as string[])],
          name: item.name,
          amount: storeAmount,
          remark: item.remark || '',
          source: effectiveAllocationMode === 'manual' ? 'manual' : 'allocation',
          feeType: item.feeType || '',
        })
      }
    }

    // c. 生成 groups
    for (const [store, rows] of storeRowsMap) {
      for (const row of rows) {
        row.seq = ++seqCounter
      }
      const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
      const reimbursementText = generateReimbursementText(
        scheme.reimbursementFormat || '',
        scheme.reimbursementCustom || '',
        rows.map(r => ({ dept: r.dept, name: r.name, amount: r.amount, feeType: r.feeType })),
        store,
        batch.feeMonth,
        batch.carrier,
      )
      groups.push({
        store,
        templateId: 0,
        schemeId: scheme.id,
        carrier: batch.carrier,
        rows,
        subtotal,
        invoiceAmount: subtotal,
        reimbursementFormat: scheme.reimbursementFormat || '',
        reimbursementCustom: scheme.reimbursementCustom || '',
        reimbursementText,
      })
    }
  } else {
    // ===== detail/invoice 模式：原有逻辑 =====

    // 查询模板
    const overrideMap = new Map<string, number>()
    if (templateOverrides && typeof templateOverrides === 'object') {
      for (const [store, templateId] of Object.entries(templateOverrides)) {
        overrideMap.set(store, Number(templateId))
      }
    }
    const templateIds = Array.from(overrideMap.values())
    let templates: any[] = []
    if (templateIds.length > 0) {
      templates = await prisma.accrualTemplate.findMany({
        where: { id: { in: templateIds } },
      })
    }
    const carrierTemplates = await prisma.accrualTemplate.findMany({
      where: { carrier: batch.carrier },
    })
    const allTemplateIds = new Set(templates.map(t => t.id))
    for (const t of carrierTemplates) {
      if (!allTemplateIds.has(t.id)) {
        templates.push(t)
        allTemplateIds.add(t.id)
      }
    }

    // 按门店分组发票
    const storeInvoiceMap = new Map<string, { invoice: any }[]>()
    for (const invoice of batch.invoices) {
      const stores = (invoice.stores as string[]) || []
      for (const store of stores) {
        if (!storeInvoiceMap.has(store)) {
          storeInvoiceMap.set(store, [])
        }
        storeInvoiceMap.get(store)!.push({ invoice })
      }
    }

    // 按明细表模式：第一遍计算所有门店号码费用
    const storeTemplates = new Map<string, any>()
    const storeEffectiveRowsMap = new Map<string, any[]>()
    let allPhoneTotal = 0

    if (useDetailMode && detailTable) {
      for (const [store] of storeInvoiceMap) {
        const template = findTemplateForStore(templates, batch.carrier, store, overrideMap)
        if (!template) continue
        storeTemplates.set(store, template)
      
        const sheets = (detailTable.sheets as any[]) || []
        let sheet = sheets.find((s: any) => s.store === store)
        if (!sheet) {
          sheet = sheets.find((s: any) => s.store?.includes(store) || store.includes(s.store || ''))
        }
        const effectiveRows = (sheet
          ? (sheet.rows as any[]) || []
          : sheets.flatMap((s: any) => (s.rows as any[]) || [])
        ).filter((r: any) => /^[\d\-]+$/.test(String(r.number || '').trim()))
        if (!sheet && sheets.length > 0) {
          console.warn(`[计提] 未找到门店「${store}」对应的明细表 sheet，已汇总全部 sheet 行作为兜底。可用 sheet:`, sheets.map(s => s.store))
        }
        storeEffectiveRowsMap.set(store, effectiveRows)
      
        // 按门店过滤模板 items（支持一个模板覆盖多门店）
        const templateItems = filterItemsByStore((template.items as any[]) || [], store)
        for (const item of templateItems) {
          if (/^[\d\-]+$/.test(item.name)) {
            const cleanName = item.name.replace(/[\s\-]/g, '')
            const detailRow = effectiveRows.find((r: any) => String(r.number).replace(/[\s\-]/g, '') === cleanName)
            allPhoneTotal += detailRow ? Number(detailRow.totalFee) || 0 : 0
          }
        }
      }
    }

    const crossStoreNonPhoneTotal = totalInvoiceAmount - allPhoneTotal
    let nonPhoneAssigned = false

    // 第二遍：为每个门店生成计提组
    for (const [store, invoiceShares] of storeInvoiceMap) {
      let template: any = undefined
      if (useDetailMode && storeTemplates.has(store)) {
        template = storeTemplates.get(store)
      } else {
        template = findTemplateForStore(templates, batch.carrier, store, overrideMap)
      }
      if (!template) continue

      const invoiceAmount = useDetailMode
        ? totalInvoiceAmount
        : invoiceShares.reduce((sum, is) => {
            const amt = Number(is.invoice.amount)
            const storeCount = ((is.invoice.stores as string[]) || []).length || 1
            return sum + amt / storeCount
          }, 0)

      // 按门店过滤模板 items（支持一个模板覆盖多门店）
      const templateItems = filterItemsByStore((template.items as any[]) || [], store)
      const rows: AccrualRow[] = []

      if (useDetailMode && detailTable) {
        const effectiveRows = storeEffectiveRowsMap.get(store) || []
        for (const item of templateItems) {
          const isPhone = /^[\d\-]+$/.test(item.name)
          let amount = 0
          if (isPhone) {
            const cleanName = item.name.replace(/[\s\-]/g, '')
            const detailRow = effectiveRows.find((r: any) => String(r.number).replace(/[\s\-]/g, '') === cleanName)
            amount = detailRow ? Number(detailRow.totalFee) || 0 : 0
          } else {
            if (!nonPhoneAssigned) {
              amount = crossStoreNonPhoneTotal
              nonPhoneAssigned = true
            }
          }
          rows.push({
            seq: 0,
            dept: [...(item.dept as string[])],
            name: item.name,
            amount,
            remark: item.remark || '',
            source: isPhone ? 'detail' : 'calculated',
            feeType: '',
          })
        }
      } else {
        // 按发票模式：优先使用模板预设金额，无预设金额才将发票总额填入第一项
        const hasPresetAmounts = templateItems.some((item: any) => Number(item.amount) > 0)
        if (hasPresetAmounts) {
          for (const item of templateItems) {
            rows.push({
              seq: 0,
              dept: [...(item.dept as string[])],
              name: item.name,
              amount: Number(item.amount) || 0,
              remark: item.remark || '',
              source: 'preset',
              feeType: '',
            })
          }
        } else {
          let itemIdx = 0
          for (const item of templateItems) {
            rows.push({
              seq: 0,
              dept: [...(item.dept as string[])],
              name: item.name,
              amount: itemIdx === 0 ? invoiceAmount : 0,
              remark: item.remark || '',
              source: itemIdx === 0 ? 'invoice' : 'preset',
              feeType: '',
            })
            itemIdx++
          }
        }
      }

      for (const row of rows) {
        row.seq = ++seqCounter
      }

      const subtotal = rows.reduce((sum, r) => sum + r.amount, 0)
      const reimbursementText = generateReimbursementText(
        template.reimbursementFormat || '',
        template.reimbursementCustom || '',
        rows.map(r => ({ dept: r.dept, name: r.name, amount: r.amount })),
        store,
        batch.feeMonth,
        batch.carrier,
      )
      groups.push({
        store,
        templateId: template.id,
        schemeId: 0,
        carrier: batch.carrier,
        rows,
        subtotal,
        invoiceAmount,
        reimbursementFormat: template.reimbursementFormat || '',
        reimbursementCustom: template.reimbursementCustom || '',
        reimbursementText,
      })
    }
  }

  // 7. 如果没有生成任何组，报错
  if (groups.length === 0) {
    const errMsg = useAllocationMode
      ? '费用分摊方案中没有费用项，无法生成计提表'
      : '未找到匹配的模板，无法生成计提表。请先在模板管理中添加对应门店的模板'
    throw createError({ statusCode: 400, message: errMsg })
  }

  // 9. 计算合计
  const totalAmount = groups.reduce((sum, g) => sum + g.subtotal, 0)

  // 10. 存库
  const accrual = await prisma.accrual.create({
    data: {
      batchId: batch.id,
      batchNo: batch.batchNo,
      carrier: batch.carrier,
      feeMonth: batch.feeMonth,
      method,
      totalAmount,
      status: 'generated',
      creator: user.username,
      groups: groups as any,
    },
  })

  // 11. 更新批次状态为已计提
  await prisma.invoiceBatch.update({
    where: { id: batch.id },
    data: { status: 'accrued' },
  })

  // 12. 操作日志
  await prisma.operationLog.create({
    data: {
      userId: user.userId,
      username: user.username,
      action: '新增',
      module: '计提管理',
      content: `生成计提表「${batch.batchNo}」（${method === 'detail' ? '按明细表' : method === 'allocation' ? '按费用分摊' : '按发票'}，${groups.length}个门店）`,
      ip: getClientIp(event),
    },
  })

  // 13. 返回序列化结果
  return {
    ...accrual,
    totalAmount: Number(accrual.totalAmount),
    createTime: formatDate(accrual.createTime),
    groups: accrual.groups,
  }
})
