/**
 * 演示版 Seed 脚本 — 使用虚拟数据，可安全公开
 * 所有门店名、供应商名、IP、密码均为虚构，不含任何真实业务数据
 * 公开仓库使用此文件替代 seed.ts
 */
import "dotenv/config"
import bcrypt from "bcryptjs"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { PrismaClient } from "../generated/prisma/client"

const adapter = new PrismaMariaDb({
  host: process.env.DATABASE_HOST,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  connectionLimit: 5,
})

const prisma = new PrismaClient({ adapter })

// 默认密码哈希（123456），动态生成避免硬编码
const DEFAULT_PASSWORD_HASH = bcrypt.hashSync('123456', 10)

// ============================================
// 1. 用户数据（4个）
// ============================================
const users = [
  { id: 1, username: 'admin', name: '系统管理员', role: '管理员', status: 1, lastLogin: new Date('2026-07-23 09:15:22'), createTime: new Date('2026-01-01 00:00:00') },
  { id: 2, username: 'operator', name: '操作员甲', role: '操作员', status: 1, lastLogin: new Date('2026-07-22 16:30:10'), createTime: new Date('2026-02-15 10:00:00') },
  { id: 3, username: 'operator2', name: '操作员乙', role: '操作员', status: 1, lastLogin: new Date('2026-07-21 14:20:33'), createTime: new Date('2026-03-01 09:00:00') },
  { id: 4, username: 'viewer', name: '查看者甲', role: '查看者', status: 0, lastLogin: new Date('2026-06-15 11:00:00'), createTime: new Date('2026-04-10 14:30:00') },
]

// ============================================
// 2. 门店/部门/机构（6个）— 虚构名称
// ============================================
const stores = [
  { id: 1, name: '总部信息部', code: '', sort: 1, status: 1 },
  { id: 2, name: '团购部', code: '', sort: 2, status: 1 },
  { id: 3, name: '演示门店A', code: 'DEMO001', sort: 3, status: 1 },
  { id: 4, name: '演示门店B', code: 'DEMO002', sort: 4, status: 1 },
  { id: 5, name: '演示门店C', code: 'DEMO003', sort: 5, status: 1 },
  { id: 6, name: '演示门店D', code: 'DEMO004', sort: 6, status: 1 },
]

// ============================================
// 3. 供应商/客户（4个）— 虚构名称
// ============================================
const suppliers = [
  { id: 1, name: '演示运营商A', contact: '联系人A', phone: '010-0000-0001', address: '演示地址A', type: '运营商', remark: '宽带及固话' },
  { id: 2, name: '演示运营商B', contact: '联系人B', phone: '010-0000-0002', address: '演示地址B', type: '运营商', remark: '企业专线' },
  { id: 3, name: '演示运营商C', contact: '联系人C', phone: '010-0000-0003', address: '演示地址C', type: '运营商', remark: '宽带服务' },
  { id: 4, name: '演示设备商A', contact: '联系人D', phone: '010-0000-0004', address: '演示地址D', type: '设备商', remark: '网络设备采购' },
]

// ============================================
// 4. 计提模板（4个）— 虚构号码
// ============================================
const templates = [
  {
    id: 1, carrier: '中国电信', store: '总部信息部',
    reimbursementFormat: '分摊明细型', reimbursementCustom: '',
    items: [
      { dept: ['总部信息部'], name: '13800000001', amount: 0, remark: '演示号码1' },
      { dept: ['总部信息部'], name: '13800000002', amount: 0, remark: '演示号码2' },
      { dept: ['团购部', '总部信息部'], name: '固话及其他费用', amount: 0, remark: '非号码行(倒推)' },
    ],
  },
  {
    id: 2, carrier: '中国电信', store: '演示门店A',
    reimbursementFormat: '汇总简明型', reimbursementCustom: '',
    items: [
      { dept: ['演示门店A'], name: '13800000003', amount: 0, remark: '演示号码3' },
      { dept: ['演示门店A'], name: '固话及其他费用', amount: 0, remark: '非号码行(倒推)' },
    ],
  },
  {
    id: 3, carrier: '中国联通', store: '总部信息部',
    reimbursementFormat: '分项列举型', reimbursementCustom: '',
    items: [
      { dept: ['总部信息部'], name: '宽带固话', amount: 0, remark: '直接填发票金额' },
      { dept: ['总部信息部'], name: '企业专线', amount: 0, remark: '直接填发票金额' },
    ],
  },
  {
    id: 4, carrier: '中国移动', store: '总部信息部',
    reimbursementFormat: '汇总简明型', reimbursementCustom: '',
    items: [
      { dept: ['总部信息部'], name: '企业专线', amount: 0, remark: '直接填发票金额' },
    ],
  },
]

// ============================================
// 4b. 费用分摊方案（2个）— FeeAllocationScheme 模型
// ============================================
const feeAllocationSchemes = [
  {
    id: 1,
    name: '电信演示分摊方案',
    carrier: '中国电信',
    reimbursementFormat: '分摊明细型',
    reimbursementCustom: '',
    items: [
      {
        feeType: '宽带',
        name: '电信宽带',
        amountSource: 'invoice',
        allocationMode: 'ratio',
        allocations: [
          { store: '演示门店A', dept: ['演示门店A'], value: 50, remark: '' },
          { store: '演示门店B', dept: ['演示门店B'], value: 30, remark: '' },
          { store: '演示门店C', dept: ['演示门店C'], value: 20, remark: '' },
        ],
        remark: '按比例分摊发票总额',
      },
      {
        feeType: '监控',
        name: '门店监控',
        amountSource: 'manual',
        allocationMode: 'manual',
        allocations: [
          { store: '演示门店A', dept: ['演示门店A'], value: 0, remark: '手动输入' },
          { store: '演示门店B', dept: ['演示门店B'], value: 0, remark: '手动输入' },
        ],
        remark: '手动输入各门店金额',
      },
    ],
  },
  {
    id: 2,
    name: '通用演示分摊方案',
    carrier: '',
    reimbursementFormat: '汇总简明型',
    reimbursementCustom: '',
    items: [
      {
        feeType: '宽带',
        name: '年费宽带',
        amountSource: 'invoice',
        allocationMode: 'fixed',
        allocations: [
          { store: '演示门店A', dept: ['演示门店A'], value: 100, remark: '固定金额' },
        ],
        remark: '通用方案，固定金额分摊',
      },
      {
        feeType: '固话',
        name: '固话月租',
        amountSource: 'manual',
        allocationMode: 'manual',
        allocations: [
          { store: '总部信息部', dept: ['总部信息部'], value: 0, remark: '手动输入' },
          { store: '团购部', dept: ['团购部'], value: 0, remark: '手动输入' },
        ],
        remark: '手动输入各门店金额',
      },
    ],
  },
]

// ============================================
// 5. 合同数据（3个）— 虚构信息
// ============================================
const contracts = [
  { id: 1, title: '演示宽带服务合同', supplierName: '演示运营商A', type: '宽带', amount: 12000, signDate: '2025-07-01', expireDate: '2026-07-01', fileName: '', remark: '演示合同' },
  { id: 2, title: '演示设备采购合同', supplierName: '演示设备商A', type: '设备采购', amount: 50000, signDate: '2025-08-01', expireDate: '2026-08-01', fileName: '', remark: '演示合同' },
  { id: 3, title: '演示维保服务合同', supplierName: '演示设备商A', type: '维保', amount: 20000, signDate: '2025-09-01', expireDate: '2026-09-01', fileName: '', remark: '演示合同' },
]

// ============================================
// 6. 预算明细（8条）— 虚构数据
// ============================================
const budgetDetails = [
  { id: 1, storeName: '演示门店A', carrier: '电信', feeType: '宽带', monthlyFee: 100, annualFee: 1200, feeRange: '2026-01~2026-12', broadbandType: '电信家宽', paymentMethod: '年缴费', remark: '演示预算' },
  { id: 2, storeName: '演示门店A', carrier: '联通', feeType: '宽带', monthlyFee: 80, annualFee: 960, feeRange: '2026-01~2026-12', broadbandType: '联通宽带', paymentMethod: '月缴费', remark: '演示预算' },
  { id: 3, storeName: '演示门店B', carrier: '电信', feeType: '宽带', monthlyFee: 100, annualFee: 1200, feeRange: '2026-01~2026-12', broadbandType: '电信家宽', paymentMethod: '年缴费', remark: '演示预算' },
  { id: 4, storeName: '演示门店B', carrier: '移动', feeType: '监控', monthlyFee: 50, annualFee: 600, feeRange: '2026-01~2026-12', broadbandType: '移动家宽', paymentMethod: '年缴费', remark: '演示预算' },
  { id: 5, storeName: '演示门店C', carrier: '电信', feeType: '物联网', monthlyFee: 30, annualFee: 360, feeRange: '2026-01~2026-12', broadbandType: '', paymentMethod: '年缴费', remark: '演示预算' },
  { id: 6, storeName: '演示门店C', carrier: '联通', feeType: '宽带', monthlyFee: 90, annualFee: 1080, feeRange: '2026-01~2026-12', broadbandType: '联通宽带', paymentMethod: '月缴费', remark: '演示预算' },
  { id: 7, storeName: '总部信息部', carrier: '电信', feeType: '宽带', monthlyFee: 300, annualFee: 3600, feeRange: '2026-01~2026-12', broadbandType: '', paymentMethod: '年缴费', remark: '演示预算' },
  { id: 8, storeName: '总部信息部', carrier: '其他', feeType: '云服务', monthlyFee: 500, annualFee: 6000, feeRange: '', broadbandType: '', paymentMethod: '年缴费', remark: '演示预算' },
]

// ============================================
// 7. 预算执行对比数据 — 从明细生成
// ============================================
function generateBudgetExecutions() {
  const storeCarrierMap = new Map<string, { storeName: string; carrier: string; budget: number }>()
  for (const d of budgetDetails) {
    const key = `${d.storeName}|${d.carrier}`
    const existing = storeCarrierMap.get(key)
    if (existing) existing.budget += d.monthlyFee
    else storeCarrierMap.set(key, { storeName: d.storeName, carrier: d.carrier, budget: d.monthlyFee })
  }
  let id = 1
  const result: { id: number; fiscalYear: number; storeName: string; carrier: string; month: string; budgetAmount: number; actualAmount: number }[] = []
  for (const month of ['2026-05', '2026-06']) {
    for (const [, sc] of storeCarrierMap) {
      const variation = 0.95 + ((id * 7) % 5) * 0.01
      result.push({
        id: id++, fiscalYear: 2026, storeName: sc.storeName, carrier: sc.carrier, month,
        budgetAmount: Math.round(sc.budget * 100) / 100,
        actualAmount: Math.round(sc.budget * variation * 100) / 100,
      })
    }
  }
  return result
}
const budgetExecutions = generateBudgetExecutions()

// ============================================
// 8. 支付配置数据 — 虚构商户号和密钥
// ============================================
const paymentConfigs = [
  { id: 1, storeId: 'DEMO001', storeName: '演示门店A', payMethod: 'wx', payMethodName: '微信', provider: '中国邮政', configName: '商户号', configValue: 'DEMO_MERCHANT_001', posNo: '', status: '正常', isSensitive: false },
  { id: 2, storeId: 'DEMO001', storeName: '演示门店A', payMethod: 'wx', payMethodName: '微信', provider: '中国邮政', configName: '密钥', configValue: 'DEMO_SECRET_PLACEHOLDER_001', posNo: '', status: '正常', isSensitive: true },
  { id: 3, storeId: 'DEMO001', storeName: '演示门店A', payMethod: 'zfb', payMethodName: '支付宝', provider: '中国邮政', configName: '商户号', configValue: 'DEMO_MERCHANT_001', posNo: '', status: '正常', isSensitive: false },
  { id: 4, storeId: 'DEMO001', storeName: '演示门店A', payMethod: 'zfb', payMethodName: '支付宝', provider: '中国邮政', configName: '密钥', configValue: 'DEMO_SECRET_PLACEHOLDER_001', posNo: '', status: '正常', isSensitive: true },
  { id: 5, storeId: 'DEMO002', storeName: '演示门店B', payMethod: 'wx', payMethodName: '微信', provider: '中国邮政', configName: '商户号', configValue: 'DEMO_MERCHANT_002', posNo: '', status: '正常', isSensitive: false },
  { id: 6, storeId: 'DEMO002', storeName: '演示门店B', payMethod: 'wx', payMethodName: '微信', provider: '中国邮政', configName: '密钥', configValue: 'DEMO_SECRET_PLACEHOLDER_002', posNo: '', status: '正常', isSensitive: true },
  { id: 7, storeId: 'DEMO003', storeName: '演示门店C', payMethod: 'yl', payMethodName: '银联', provider: '中国邮政', configName: '商户号', configValue: 'DEMO_MERCHANT_003', posNo: '', status: '正常', isSensitive: false },
  { id: 8, storeId: 'DEMO003', storeName: '演示门店C', payMethod: 'yzf', payMethodName: '翼支付', provider: '昂捷', configName: '翼支付商户号', configValue: 'DEMO_YZF_003', posNo: '', status: '正常', isSensitive: false },
]

// ============================================
// 9. 服务器数据（3个）— 虚构IP和密码
// ============================================
const servers = [
  { id: 1, name: '演示数据库服务器', serverType: '本地', cloudAccount: '', internalIp: '192.168.0.10', externalIp: '', port: '22', cpuModel: 'Demo CPU', cpuCores: '4核', memorySize: '8GB', systemDiskSize: '50GB', dataDiskSize: '500GB', diskType: 'SSD', os: 'Ubuntu 22.04', purpose: '演示用数据库服务器', account: 'admin', password: 'DEMO_PASSWORD_PLACEHOLDER', dbAccount: 'root', dbPassword: 'DEMO_DB_PASSWORD_PLACEHOLDER', dbPort: '3306', expireDate: '', remark: '演示数据', status: '正常' },
  { id: 2, name: '演示云服务器A', serverType: '阿里云', cloudAccount: 'demo@example.com', internalIp: '', externalIp: '203.0.113.10', port: '22', cpuModel: 'Demo CPU', cpuCores: '2核', memorySize: '4GB', systemDiskSize: '40GB', dataDiskSize: '100GB', diskType: 'SSD', os: 'Ubuntu 22.04', purpose: '演示用Web服务器', account: 'root', password: 'DEMO_PASSWORD_PLACEHOLDER', dbAccount: '', dbPassword: '', dbPort: '', expireDate: '2026-12-31', remark: '演示数据', status: '正常' },
  { id: 3, name: '演示云服务器B', serverType: '腾讯云', cloudAccount: 'demo@example.com', internalIp: '', externalIp: '203.0.113.20', port: '22', cpuModel: 'Demo CPU', cpuCores: '1核', memorySize: '2GB', systemDiskSize: '40GB', dataDiskSize: '', diskType: 'SSD', os: 'CentOS 8', purpose: '演示用缓存服务器', account: 'root', password: 'DEMO_PASSWORD_PLACEHOLDER', dbAccount: '', dbPassword: '', dbPort: '', expireDate: '2026-06-30', remark: '演示数据', status: '停用' },
]

// ============================================
// 10. 域名数据（1个）— 虚构域名
// ============================================
const domains = [
  { id: 1, domain: 'demo-example.com', mainAccount: 'demo@example.com', mainPassword: 'DEMO_PASSWORD_PLACEHOLDER', certType: 'DV', certIssuer: "Let's Encrypt", certRenewDate: '2026-01-01', certExpireDate: '2026-04-01', remark: '演示域名', status: '正常' },
]

// ============================================
// 11. 小程序数据（1个）— 虚构信息
// ============================================
const miniapps = [
  { id: 1, name: '演示小程序', email: 'demo@example.com', emailPassword: 'DEMO_PASSWORD_PLACEHOLDER', remark: '演示用小程序', status: '正常' },
]

// ============================================
// 12. 操作日志（5条）— 虚构IP
// ============================================
const operationLogs = [
  { id: 1, userId: 1, username: 'admin', action: '登录', module: '系统管理', content: '用户登录系统', ip: '192.168.0.100', createdAt: new Date('2026-07-23 09:15:22') },
  { id: 2, userId: 1, username: 'admin', action: '新增', module: '合同管理', content: '新增合同「演示宽带服务合同」', ip: '192.168.0.100', createdAt: new Date('2026-07-23 09:32:10') },
  { id: 3, userId: 2, username: 'operator', action: '编辑', module: '基础配置', content: '编辑计提模板「中国电信-总部信息部」', ip: '192.168.0.105', createdAt: new Date('2026-07-22 16:45:22') },
  { id: 4, userId: 2, username: 'operator', action: '新增', module: '发票管理', content: '创建发票批次 202606DX01', ip: '192.168.0.105', createdAt: new Date('2026-07-22 17:10:05') },
  { id: 5, userId: 3, username: 'operator2', action: '登录', module: '系统管理', content: '用户登录系统', ip: '192.168.0.108', createdAt: new Date('2026-07-21 14:20:33') },
]

// ============================================
// 主函数：执行 Seed
// ============================================
async function main() {
  console.log('🌱 开始写入演示数据（seed.demo）...\n')

  console.log('  写入用户数据 (4条)...')
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: { username: u.username, passwordHash: DEFAULT_PASSWORD_HASH, name: u.name, role: u.role, status: u.status, lastLogin: u.lastLogin },
      create: { id: u.id, username: u.username, passwordHash: DEFAULT_PASSWORD_HASH, name: u.name, role: u.role, status: u.status, lastLogin: u.lastLogin },
    })
  }

  console.log('  写入门店数据 (6条)...')
  for (const s of stores) {
    await prisma.store.upsert({
      where: { id: s.id },
      update: { name: s.name, code: s.code, sort: s.sort, status: s.status },
      create: { id: s.id, name: s.name, code: s.code, sort: s.sort, status: s.status },
    })
  }

  console.log('  写入供应商数据 (4条)...')
  for (const s of suppliers) {
    await prisma.supplier.upsert({
      where: { id: s.id },
      update: { name: s.name, contact: s.contact, phone: s.phone, address: s.address, type: s.type, remark: s.remark },
      create: { id: s.id, name: s.name, contact: s.contact, phone: s.phone, address: s.address, type: s.type, remark: s.remark },
    })
  }

  console.log('  写入计提模板数据 (4条)...')
  for (const t of templates) {
    await prisma.accrualTemplate.upsert({
      where: { id: t.id },
      update: { carrier: t.carrier, store: t.store, itemCount: t.items.length, reimbursementFormat: t.reimbursementFormat, reimbursementCustom: t.reimbursementCustom, items: t.items as any },
      create: { id: t.id, carrier: t.carrier, store: t.store, itemCount: t.items.length, reimbursementFormat: t.reimbursementFormat, reimbursementCustom: t.reimbursementCustom, items: t.items as any },
    })
  }

  // 4b. 费用分摊方案
  console.log(`  写入费用分摊方案数据 (${feeAllocationSchemes.length}条)...`)
  for (const s of feeAllocationSchemes) {
    await prisma.feeAllocationScheme.upsert({
      where: { id: s.id },
      update: { name: s.name, carrier: s.carrier, items: s.items as any, reimbursementFormat: s.reimbursementFormat, reimbursementCustom: s.reimbursementCustom, status: 1 },
      create: { id: s.id, name: s.name, carrier: s.carrier, items: s.items as any, reimbursementFormat: s.reimbursementFormat, reimbursementCustom: s.reimbursementCustom, status: 1 },
    })
  }

  console.log('  写入合同数据 (3条)...')
  for (const c of contracts) {
    await prisma.contract.upsert({
      where: { id: c.id },
      update: { title: c.title, supplierName: c.supplierName, type: c.type, amount: c.amount, signDate: c.signDate, expireDate: c.expireDate, fileName: c.fileName, remark: c.remark },
      create: { id: c.id, title: c.title, supplierName: c.supplierName, type: c.type, amount: c.amount, signDate: c.signDate, expireDate: c.expireDate, fileName: c.fileName, remark: c.remark },
    })
  }

  console.log('  写入预算明细数据 (8条)...')
  for (const d of budgetDetails) {
    await prisma.budgetDetail.upsert({
      where: { id: d.id },
      update: { fiscalYear: 2026, storeName: d.storeName, carrier: d.carrier, feeType: d.feeType, monthlyFee: d.monthlyFee, annualFee: d.annualFee, feeRange: d.feeRange, broadbandType: d.broadbandType, paymentMethod: d.paymentMethod, remark: d.remark },
      create: { id: d.id, fiscalYear: 2026, storeName: d.storeName, carrier: d.carrier, feeType: d.feeType, monthlyFee: d.monthlyFee, annualFee: d.annualFee, feeRange: d.feeRange, broadbandType: d.broadbandType, paymentMethod: d.paymentMethod, remark: d.remark },
    })
  }

  console.log(`  写入预算执行对比数据 (${budgetExecutions.length}条)...`)
  for (const e of budgetExecutions) {
    await prisma.budgetExecution.upsert({
      where: { id: e.id },
      update: { fiscalYear: e.fiscalYear, storeName: e.storeName, carrier: e.carrier, month: e.month, budgetAmount: e.budgetAmount, actualAmount: e.actualAmount },
      create: { id: e.id, fiscalYear: e.fiscalYear, storeName: e.storeName, carrier: e.carrier, month: e.month, budgetAmount: e.budgetAmount, actualAmount: e.actualAmount },
    })
  }

  console.log(`  写入支付配置数据 (${paymentConfigs.length}条)...`)
  for (const c of paymentConfigs) {
    await prisma.paymentConfig.upsert({
      where: { id: c.id },
      update: { storeId: c.storeId, storeName: c.storeName, payMethod: c.payMethod, payMethodName: c.payMethodName, provider: c.provider, configName: c.configName, configValue: c.configValue, posNo: c.posNo, status: c.status, isSensitive: c.isSensitive },
      create: { id: c.id, storeId: c.storeId, storeName: c.storeName, payMethod: c.payMethod, payMethodName: c.payMethodName, provider: c.provider, configName: c.configName, configValue: c.configValue, posNo: c.posNo, status: c.status, isSensitive: c.isSensitive },
    })
  }

  console.log('  写入服务器数据 (3条)...')
  for (const s of servers) {
    await prisma.server.upsert({
      where: { id: s.id },
      update: { name: s.name, serverType: s.serverType, cloudAccount: s.cloudAccount, internalIp: s.internalIp, externalIp: s.externalIp, port: s.port, cpuModel: s.cpuModel, cpuCores: s.cpuCores, memorySize: s.memorySize, systemDiskSize: s.systemDiskSize, dataDiskSize: s.dataDiskSize, diskType: s.diskType, os: s.os, purpose: s.purpose, account: s.account, password: s.password, dbAccount: s.dbAccount, dbPassword: s.dbPassword, dbPort: s.dbPort, expireDate: s.expireDate, remark: s.remark, status: s.status },
      create: { id: s.id, name: s.name, serverType: s.serverType, cloudAccount: s.cloudAccount, internalIp: s.internalIp, externalIp: s.externalIp, port: s.port, cpuModel: s.cpuModel, cpuCores: s.cpuCores, memorySize: s.memorySize, systemDiskSize: s.systemDiskSize, dataDiskSize: s.dataDiskSize, diskType: s.diskType, os: s.os, purpose: s.purpose, account: s.account, password: s.password, dbAccount: s.dbAccount, dbPassword: s.dbPassword, dbPort: s.dbPort, expireDate: s.expireDate, remark: s.remark, status: s.status },
    })
  }

  console.log('  写入域名数据 (1条)...')
  for (const d of domains) {
    await prisma.domain.upsert({
      where: { id: d.id },
      update: { domain: d.domain, mainAccount: d.mainAccount, mainPassword: d.mainPassword, certType: d.certType, certIssuer: d.certIssuer, certRenewDate: d.certRenewDate, certExpireDate: d.certExpireDate, remark: d.remark, status: d.status },
      create: { id: d.id, domain: d.domain, mainAccount: d.mainAccount, mainPassword: d.mainPassword, certType: d.certType, certIssuer: d.certIssuer, certRenewDate: d.certRenewDate, certExpireDate: d.certExpireDate, remark: d.remark, status: d.status },
    })
  }

  console.log('  写入小程序数据 (1条)...')
  for (const m of miniapps) {
    await prisma.miniapp.upsert({
      where: { id: m.id },
      update: { name: m.name, email: m.email, emailPassword: m.emailPassword, remark: m.remark, status: m.status },
      create: { id: m.id, name: m.name, email: m.email, emailPassword: m.emailPassword, remark: m.remark, status: m.status },
    })
  }

  console.log('  写入操作日志数据 (5条)...')
  for (const log of operationLogs) {
    await prisma.operationLog.upsert({
      where: { id: log.id },
      update: { userId: log.userId, username: log.username, action: log.action, module: log.module, content: log.content, ip: log.ip, createdAt: log.createdAt },
      create: { id: log.id, userId: log.userId, username: log.username, action: log.action, module: log.module, content: log.content, ip: log.ip, createdAt: log.createdAt },
    })
  }

  console.log('\n✅ 演示数据写入完成！')
  console.log(`   用户: ${users.length} | 门店: ${stores.length} | 供应商: ${suppliers.length}`)
  console.log(`   计提模板: ${templates.length} | 费用分摊方案: ${feeAllocationSchemes.length} | 合同: ${contracts.length}`)
  console.log(`   预算明细: ${budgetDetails.length} | 预算执行: ${budgetExecutions.length}`)
  console.log(`   支付配置: ${paymentConfigs.length} | 服务器: ${servers.length}`)
  console.log(`   域名: ${domains.length} | 小程序: ${miniapps.length}`)
  console.log(`   操作日志: ${operationLogs.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed 执行失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
