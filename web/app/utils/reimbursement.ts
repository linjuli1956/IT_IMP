/**
 * 报销说明文本生成 — 共享工具函数
 * 服务端 generate.post.ts / [id].put.ts 与前端 useAccrualData.ts 共用此实现
 * 修改此函数即同步更新前后端逻辑，避免预览与生成不一致
 */

/** 报销说明行数据结构 */
export interface ReimbursementRow {
  dept: string[]
  name: string
  amount: number
  feeType?: string
}

/**
 * 生成报销说明文本
 * @param format 报销说明格式（分摊明细型 / 汇总简明型 / 年费描述型 / 分项列举型 / 自定义）
 * @param customText 自定义格式文本（当 format='自定义' 时使用）
 * @param rows 计提表行数据
 * @param store 门店名称
 * @param feeMonth 费用月（格式 YYYY-MM）
 * @param carrier 运营商
 */
export function generateReimbursementText(
  format: string,
  customText: string,
  rows: ReimbursementRow[],
  store: string,
  feeMonth: string,
  carrier: string,
): string {
  // 转换费用月格式：2026-06 → 2026年06月
  const monthStr = feeMonth.replace(/-(\d{2})$/, '年$1月')
  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0)
  const amountStr = totalAmount.toFixed(2)

  // ===== allocation 模式：按费用类型组织报销说明 =====
  const hasFeeType = rows.some(r => r.feeType)
  if (hasFeeType) {
    const feeTypeMap = new Map<string, { name: string, amount: number, dept: string[] }[]>()
    for (const row of rows) {
      const ft = row.feeType || '其他'
      if (!feeTypeMap.has(ft)) feeTypeMap.set(ft, [])
      feeTypeMap.get(ft)!.push({ name: row.name, amount: row.amount, dept: row.dept })
    }
    switch (format) {
      case '分摊明细型': {
        const parts: string[] = []
        for (const [ft, items] of feeTypeMap) {
          const itemStr = items.map(i => `${i.dept.join('')}${i.amount.toFixed(2)}元`).join('、')
          parts.push(`${ft}：${itemStr}；`)
        }
        return `${monthStr}${carrier}${store}费用分摊明细：${parts.join('')}\n总计：${amountStr} 元；`
      }
      case '汇总简明型': {
        const feeTypes = Array.from(feeTypeMap.keys())
        return `${monthStr}${carrier}${store}费用，${feeTypes.join('、')}：${amountStr}元`
      }
      case '年费描述型': {
        const feeTypes = Array.from(feeTypeMap.keys())
        return `${monthStr}${carrier}${store}使用${feeTypes.join('、')}（主用于办公、WiFi、收银等）年费：${amountStr}元；`
      }
      case '分项列举型': {
        const items = rows.map(row => {
          const deptStr = row.dept.join('')
          return `${deptStr}${row.feeType || ''}${row.name}：${row.amount.toFixed(2)}元`
        })
        return `${monthStr}${carrier}${items.join('，')}。合计：${amountStr}元`
      }
      case '自定义': {
        let text = customText || '请输入自定义格式'
        text = text.replace(/\{门店\}/g, store)
        text = text.replace(/\{年月\}/g, monthStr)
        text = text.replace(/\{运营商\}/g, carrier)
        text = text.replace(/\{费用类型\}/g, Array.from(feeTypeMap.keys()).join('、'))
        text = text.replace(/\{金额\}/g, amountStr)
        text = text.replace(/\{部门\}/g, Array.from(new Set(rows.flatMap(r => r.dept))).join('、'))
        return text
      }
      default:
        return `${monthStr}${carrier}${store}费用：${amountStr}元`
    }
  }

  // ===== detail/invoice 模式：原有号码/非号码逻辑 =====
  // 按部门分组统计（区分手机号码和固话）
  const isPhoneNumber = (name: string) => /^[\d\-]+$/.test(name)
  const isLandline = (name: string) => /^[\d\-]+$/.test(name) && name.includes('-')
  const deptMap = new Map<string, { mobileCount: number, mobileAmount: number, landlineCount: number, landlineAmount: number, nonPhoneItems: { name: string, amount: number }[], amount: number }>()
  for (const row of rows) {
    const isPhone = isPhoneNumber(row.name)
    const firstDept = row.dept.find(d => d)
    const targetDepts = isPhone ? row.dept : (firstDept ? [firstDept] : [])
    for (const dept of targetDepts) {
      if (!deptMap.has(dept)) {
        deptMap.set(dept, { mobileCount: 0, mobileAmount: 0, landlineCount: 0, landlineAmount: 0, nonPhoneItems: [], amount: 0 })
      }
      const d = deptMap.get(dept)!
      if (isPhone) {
        if (isLandline(row.name)) {
          d.landlineCount++
          d.landlineAmount += row.amount
        } else {
          d.mobileCount++
          d.mobileAmount += row.amount
        }
      } else {
        d.nonPhoneItems.push({ name: row.name, amount: row.amount })
      }
      d.amount += row.amount
    }
  }

  switch (format) {
    case '分摊明细型': {
      const allDepts = Array.from(deptMap.keys())
      const deptListStr = allDepts.join('、')
      const parts: string[] = []
      for (const [dept, data] of deptMap) {
        if (data.mobileCount > 0) {
          parts.push(`${dept}承担${data.mobileCount}个手机号码：${data.mobileAmount.toFixed(2)} 元；`)
        }
        if (data.landlineCount > 0) {
          parts.push(`${dept}承担${data.landlineCount}个固话：${data.landlineAmount.toFixed(2)} 元；`)
        }
        for (const item of data.nonPhoneItems) {
          if (Math.abs(item.amount) > 0.001) {
            parts.push(`${dept}承担${item.name}：${item.amount.toFixed(2)} 元；`)
          }
        }
      }
      return `${monthStr}${carrier}${deptListStr}费用分摊明细：${parts.join('')}\n总计：${amountStr} 元；`
    }
    case '汇总简明型': {
      const feeTypes = rows
        .map(row => row.name)
        .filter(name => name && !/^[\d\-]+$/.test(name))
      const feeTypeStr = feeTypes.length > 0 ? feeTypes.join('、') : '宽带固话'
      return `${monthStr}${carrier}${store}费用，${feeTypeStr}（含话费）：${amountStr}元`
    }
    case '年费描述型': {
      const feeType = rows
        .map(row => row.name)
        .find(name => name && !/^[\d\-]+$/.test(name)) || '宽带'
      return `${monthStr}${carrier}${store}使用${feeType}（主用于办公、WiFi、收银等）年费：${store}${feeType}1条，年费${amountStr}元；`
    }
    case '分项列举型': {
      const items = rows.map(row => {
        const deptStr = row.dept.join('')
        return `${deptStr}${row.name}1条：${row.amount.toFixed(2)}元`
      })
      return `${monthStr}${carrier}${items.join('，')}。合计：${amountStr}元`
    }
    case '自定义': {
      let text = customText || '请输入自定义格式'
      text = text.replace(/\{门店\}/g, store)
      text = text.replace(/\{年月\}/g, monthStr)
      text = text.replace(/\{运营商\}/g, carrier)
      text = text.replace(/\{费用类型\}/g, '宽带固话')
      text = text.replace(/\{金额\}/g, amountStr)
      text = text.replace(/\{部门\}/g, Array.from(deptMap.keys()).join('、'))
      text = text.replace(/\{号码数\}/g, String(Array.from(deptMap.values()).reduce((sum, d) => sum + d.mobileCount + d.landlineCount, 0)))
      return text
    }
    default:
      return `${monthStr}${carrier}${store}费用：${amountStr}元`
  }
}
