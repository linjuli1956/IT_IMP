/**
 * 报销说明文本与单位解析单元测试
 * 真实断言：单位回退规则、分项列举型/年费描述型/分摊明细型的单位输出、allocation 分支不受影响。
 */
import { describe, it, expect } from 'vitest'
import { generateReimbursementText, resolveItemUnit } from './reimbursement'

describe('resolveItemUnit', () => {
  it('显式单位优先', () => {
    expect(resolveItemUnit('固话', '部')).toBe('部')
    expect(resolveItemUnit('宽带', '线')).toBe('线')
    expect(resolveItemUnit('其它', ' 项 ')).toBe('项')
  })

  it('未填单位时按名称关键字回退', () => {
    expect(resolveItemUnit('固话')).toBe('部')
    expect(resolveItemUnit('办公电话')).toBe('部')
    expect(resolveItemUnit('宽带')).toBe('条')
    expect(resolveItemUnit('专线')).toBe('条')
    expect(resolveItemUnit('光纤线路')).toBe('条')
    expect(resolveItemUnit('固定IP')).toBe('个')
    expect(resolveItemUnit('手机号码')).toBe('个')
  })

  it('按费用类型关键字回退', () => {
    expect(resolveItemUnit('', undefined, '固话')).toBe('部')
    expect(resolveItemUnit('', undefined, '宽带')).toBe('条')
  })

  it('无法识别时不带单位', () => {
    expect(resolveItemUnit('其他费用')).toBe('')
    expect(resolveItemUnit('')).toBe('')
  })
})

describe('generateReimbursementText — 分项列举型（发票/明细模式）', () => {
  it('使用显式单位，不再写死「条」', () => {
    const text = generateReimbursementText('分项列举型', '', [
      { dept: ['钟山宝龙店'], name: '固话', amount: 100, unit: '部' },
      { dept: ['钟山宝龙店'], name: '宽带', amount: 200, unit: '条' },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toBe('2026年09月中国移动钟山宝龙店固话1部：100.00元，钟山宝龙店宽带1条：200.00元。合计：300.00元')
    expect(text).not.toContain('固话1条')
  })

  it('未填单位时按名称回退（固话→部、宽带→条）', () => {
    const text = generateReimbursementText('分项列举型', '', [
      { dept: ['钟山宝龙店'], name: '固话', amount: 0 },
      { dept: ['钟山宝龙店'], name: '宽带', amount: 0 },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toContain('钟山宝龙店固话1部：0.00元')
    expect(text).toContain('钟山宝龙店宽带1条：0.00元')
  })

  it('无法识别的名称不带单位', () => {
    const text = generateReimbursementText('分项列举型', '', [
      { dept: ['钟山宝龙店'], name: '其他费用', amount: 50 },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toBe('2026年09月中国移动钟山宝龙店其他费用：50.00元。合计：50.00元')
  })
})

describe('generateReimbursementText — 年费描述型', () => {
  it('单位与金额正确', () => {
    const text = generateReimbursementText('年费描述型', '', [
      { dept: ['钟山宝龙店'], name: '宽带', amount: 1200, unit: '条' },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toBe('2026年09月中国移动钟山宝龙店使用宽带（主用于办公、WiFi、收银等）年费：钟山宝龙店宽带1条，年费1200.00元；')
  })

  it('未识别单位时不带数量后缀', () => {
    const text = generateReimbursementText('年费描述型', '', [
      { dept: ['钟山宝龙店'], name: '其他费用', amount: 100 },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toContain('年费：钟山宝龙店其他费用，年费100.00元；')
  })
})

describe('generateReimbursementText — 分摊明细型', () => {
  it('固话用「部」、手机号码用「个」', () => {
    const text = generateReimbursementText('分摊明细型', '', [
      { dept: ['网络部'], name: '13800000001', amount: 50 },
      { dept: ['网络部'], name: '0755-1234567', amount: 30 },
    ], '钟山宝龙店', '2026-09', '中国移动')
    expect(text).toContain('网络部承担1个手机号码：50.00 元；')
    expect(text).toContain('网络部承担1部固话：30.00 元；')
  })
})

describe('generateReimbursementText — 费用分摊（allocation）分支不受影响', () => {
  it('分项列举型保持原有文本结构', () => {
    const text = generateReimbursementText('分项列举型', '', [
      { dept: ['门店A'], name: '宽带费', amount: 100, feeType: '宽带' },
    ], '门店A', '2026-09', '中国移动')
    expect(text).toBe('2026年09月中国移动门店A宽带宽带费：100.00元。合计：100.00元')
  })
})
