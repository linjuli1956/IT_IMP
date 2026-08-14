// @ts-nocheck
/**
 * 阶段 D — 资产页面统一落地批次 验收截图脚本（含断言）
 *
 * 验收规则：
 * 1. ADMIN_USER / ADMIN_PASS / VIEWER_USER / VIEWER_PASS 缺任一项即失败退出
 * 2. 管理员截图断言：新增、导出、编辑、删除存在
 * 3. 查看者截图断言：身份确为查看者，复制按钮存在，新增/编辑/删除/批量删除/导出不存在
 * 4. Drawer 截图前必须断言 Drawer 已打开，并断言白名单复制按钮可见
 * 5. 小程序断言卡片态、列表态及平铺编辑/删除
 * 6. CSV 下载断言 BOM、文件名、当前页白名单列、敏感字段排除
 * 7. 每张截图目标状态未达成即失败，不得保存错误页面冒充通过
 * 8. 数据质量断言：不允许出现 null/undefined；小程序卡片名称/副标题不允许为无业务意义测试值
 */
const { chromium } = require('playwright')
const { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } = require('node:fs')
const { join } = require('node:path')

// ===== Configuration =====
const BASE_URL = process.env.BASE_URL || 'http://localhost:3999'
const ADMIN_USER = process.env.ADMIN_USER || process.env.LOGIN_USER
const ADMIN_PASS = process.env.ADMIN_PASS || process.env.LOGIN_PASS
const VIEWER_USER = process.env.VIEWER_USER || process.env.VIEWER_USERNAME
const VIEWER_PASS = process.env.VIEWER_PASS || process.env.VIEWER_PASSWORD
const OUT_DIR = join(process.cwd(), 'scripts', 'visual-regression', 'screenshots', 'stage-d')
const CSV_LOG = join(OUT_DIR, 'csv-verification.log')

const RESOLUTIONS = [
  { w: 1366, h: 768, label: '1366' },
  { w: 1440, h: 1024, label: '1440' },
]

// CSV whitelist per page: filename, expected headers, forbidden (sensitive) headers
const CSV_WHITELIST = {
  computers: {
    filename: '电脑台账.csv',
    headers: ['名称', '资产编号', '序列号', '型号', 'IP地址', 'MAC地址'],
    forbidden: ['品牌', '使用人', '部门', '门店', '状态', '备注', '操作系统', 'CPU', '内存', '硬盘', '保修'],
  },
  phones: {
    filename: '固话台账.csv',
    headers: ['固话号码', '分机号', '门店', '部门', '位置'],
    forbidden: ['运营商', '使用人', '月租', '套餐', '状态', '备注', '密码'],
  },
  scales: {
    filename: '电子称台账.csv',
    headers: ['名称', '资产编号', '序列号', '型号', '位置'],
    forbidden: ['品牌', '量程', '精度', '接口', '校准', '状态', '备注', '门店'],
  },
  miniapps: {
    filename: '小程序台账.csv',
    headers: ['小程序名称', '状态', '备注'],
    forbidden: ['邮箱', '密码', 'email', 'password', 'token', 'secret'],
  },
}

// ===== Assertion helpers =====
let csvLogLines = []
let shotCount = 0

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERT FAILED: ${message}`)
  }
  console.log(`  ✓ ${message}`)
}

async function assertButtonExists(page, text, label) {
  const found = await page.evaluate((searchText) => {
    const buttons = Array.from(document.querySelectorAll('.el-button'))
    return buttons.some(btn => {
      const t = (btn.textContent || '').trim()
      return t.includes(searchText) && btn.offsetParent !== null
    })
  }, text)
  assert(found, `${label}: 按钮含"${text}"存在且可见`)
}

async function assertButtonNotExists(page, text, label) {
  const found = await page.evaluate((searchText) => {
    const buttons = Array.from(document.querySelectorAll('.el-button'))
    return buttons.some(btn => {
      const t = (btn.textContent || '').trim()
      return t.includes(searchText) && btn.offsetParent !== null
    })
  }, text)
  assert(!found, `${label}: 按钮含"${text}"不应存在`)
}

async function assertRole(page, expectedRole, label) {
  const role = await page.evaluate(() => {
    const raw = localStorage.getItem('user_info')
    if (!raw) return null
    try { return JSON.parse(raw).role } catch { return null }
  })
  assert(role === expectedRole, `${label}: 用户角色为"${expectedRole}"（实际: ${role}）`)
}

async function assertTableHasRows(page, label) {
  const rows = await page.$$('.el-table__row')
  assert(rows.length > 0, `${label}: 表格有数据行（${rows.length} 行）`)
}

async function assertCopyableCellButtons(page, label) {
  const count = await page.evaluate(() => {
    const btns = document.querySelectorAll('.el-table .copyable-cell__btn')
    return Array.from(btns).filter(b => b.offsetParent !== null).length
  })
  assert(count > 0, `${label}: 表格中可复制列按钮存在（${count} 个可见）`)
}

async function assertDrawerOpen(page, label) {
  const drawer = await page.$('.el-drawer')
  assert(drawer && await drawer.isVisible(), `${label}: Drawer 已打开`)
}

async function assertDrawerCopyButtons(page, label) {
  const count = await page.evaluate(() => {
    const btns = document.querySelectorAll('.el-drawer .drawer-copy-btn')
    return Array.from(btns).filter(b => b.offsetParent !== null).length
  })
  assert(count > 0, `${label}: Drawer 中白名单复制按钮可见（${count} 个）`)
}

async function assertCardEditDelete(page, label) {
  const result = await page.evaluate(() => {
    const card = document.querySelector('.service-card')
    if (!card) return { found: false, edit: false, delete: false }
    const text = card.textContent || ''
    return { found: true, edit: text.includes('编辑'), delete: text.includes('删除') }
  })
  assert(result.found, `${label}: 卡片存在`)
  assert(result.edit, `${label}: 卡片平铺编辑按钮存在`)
  assert(result.delete, `${label}: 卡片平铺删除按钮存在`)
}

// ===== Data quality assertions =====
const DIRTY_VALUES = ['123', '333', '555', '111', '222', 'test', 'e2e']

async function assertNoNullUndefined(page, label) {
  const count = await page.evaluate(() => {
    const sels = '.el-table .cell, .service-card__title, .service-card__subtitle, .el-descriptions__content, .el-descriptions__content-cell'
    const els = document.querySelectorAll(sels)
    let found = 0
    for (const el of els) {
      const text = (el.textContent || '').trim().toLowerCase()
      if (text === 'null' || text === 'undefined') found++
    }
    return found
  })
  assert(count === 0, `${label}: 数据区域无 null/undefined（${count} 处）`)
}

async function assertNoCardTestValues(page, label) {
  const issues = await page.evaluate((dirtyVals) => {
    const cards = document.querySelectorAll('.service-card')
    const problems = []
    for (const card of cards) {
      const titleEl = card.querySelector('.service-card__title')
      const subtitleEl = card.querySelector('.service-card__subtitle')
      const title = titleEl ? (titleEl.textContent || '').trim() : ''
      const subtitle = subtitleEl ? (subtitleEl.textContent || '').trim() : ''
      if (dirtyVals.includes(title)) problems.push(`标题="${title}"`)
      if (dirtyVals.includes(subtitle)) problems.push(`副标题="${subtitle}"`)
    }
    return problems
  }, DIRTY_VALUES)
  assert(issues.length === 0, `${label}: 卡片名称/副标题无测试值（${issues.length} 处${issues.length > 0 ? ': ' + issues.join(', ') : ''}）`)
}

// ===== Login =====
async function login(page, user, pass) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('.login-form', { timeout: 10000 })
  await page.fill('input[placeholder="请输入用户名"]', user)
  await page.fill('input[placeholder="请输入密码"]', pass)
  await page.click('.login-btn')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

// ===== Drawer helpers =====
async function openDrawer(page) {
  const row = await page.$('.el-table__row')
  assert(row, '表格行存在，可打开 Drawer')
  await row.click()
  await page.waitForSelector('.el-drawer', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(1000)
}

async function openCardDrawer(page) {
  const card = await page.$('.service-card')
  assert(card, '服务卡片存在，可打开 Drawer')
  await card.click()
  await page.waitForSelector('.el-drawer', { state: 'visible', timeout: 5000 })
  await page.waitForTimeout(1000)
}

async function closeDrawer(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

// ===== Screenshot with pre-assertion =====
async function verifiedShot(page, name, assertFn) {
  await assertNoNullUndefined(page, name)
  if (assertFn) await assertFn()
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log(`  ✓ ${name}.png`)
  shotCount++
}

// ===== CSV verification =====
async function verifyCsvDownload(page, pageName) {
  const config = CSV_WHITELIST[pageName]
  if (!config) throw new Error(`Unknown page: ${pageName}`)

  const downloadPromise = page.waitForEvent('download', { timeout: 5000 })
  await page.click('button:has-text("导出当前页 CSV")')
  const download = await downloadPromise

  const suggested = download.suggestedFilename()
  assert(suggested === config.filename, `CSV 文件名: ${suggested} === ${config.filename}`)

  const tmpPath = join(OUT_DIR, `_tmp_${pageName}.csv`)
  await download.saveAs(tmpPath)
  const buffer = readFileSync(tmpPath)

  // BOM check
  const hasBom = buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF
  assert(hasBom, `CSV BOM: UTF-8 BOM 存在`)

  // Parse content (skip BOM bytes)
  const content = buffer.toString('utf-8', 3)
  const lines = content.split('\r\n').filter(l => l.length > 0)
  const headerLine = lines[0]

  // Whitelist headers
  for (const h of config.headers) {
    assert(headerLine.includes(h), `CSV 白名单列: "${h}" 存在于表头`)
  }

  // Forbidden (sensitive) headers
  for (const f of config.forbidden) {
    assert(!headerLine.toLowerCase().includes(f.toLowerCase()), `CSV 敏感字段: "${f}" 不在表头`)
  }

  // Log
  csvLogLines.push(`[${pageName}] filename=${suggested} BOM=${hasBom} headers="${headerLine}" rows=${lines.length - 1} OK`)

  // Cleanup temp file
  try { unlinkSync(tmpPath) } catch {}

  console.log(`  ✓ CSV 验证通过: ${suggested} (${lines.length - 1} 行数据)`)
}

// ===== Admin flow =====
async function adminFlow(browser) {
  for (const res of RESOLUTIONS) {
    const page = await browser.newPage({ viewport: { width: res.w, height: res.h } })
    console.log(`\n=== 管理员 @ ${res.w}×${res.h} ===`)
    await login(page, ADMIN_USER, ADMIN_PASS)
    await assertRole(page, '管理员', `Admin@${res.label}`)

    // —— 电脑管理 ——
    console.log('电脑管理...')
    await page.goto(`${BASE_URL}/it/computers`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `admin-computers-${res.label}`, async () => {
      await assertTableHasRows(page, 'Computers')
      await assertButtonExists(page, '新增', 'Computers 新增')
      await assertButtonExists(page, '导出', 'Computers 导出')
      await assertButtonExists(page, '编辑', 'Computers 编辑')
      await assertButtonExists(page, '删除', 'Computers 删除')
    })

    console.log('  Drawer...')
    await openDrawer(page)
    await verifiedShot(page, `admin-computers-drawer-${res.label}`, async () => {
      await assertDrawerOpen(page, 'Computers Drawer')
      await assertDrawerCopyButtons(page, 'Computers Drawer 复制按钮')
    })
    await closeDrawer(page)

    if (res.label === '1366') {
      console.log('  CSV...')
      await verifyCsvDownload(page, 'computers')
    }

    // —— 固话管理 ——
    console.log('固话管理...')
    await page.goto(`${BASE_URL}/it/phones`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `admin-phones-${res.label}`, async () => {
      await assertTableHasRows(page, 'Phones')
      await assertButtonExists(page, '新增', 'Phones 新增')
      await assertButtonExists(page, '导出', 'Phones 导出')
      await assertButtonExists(page, '编辑', 'Phones 编辑')
      await assertButtonExists(page, '删除', 'Phones 删除')
    })

    console.log('  Drawer...')
    await openDrawer(page)
    await verifiedShot(page, `admin-phones-drawer-${res.label}`, async () => {
      await assertDrawerOpen(page, 'Phones Drawer')
      await assertDrawerCopyButtons(page, 'Phones Drawer 复制按钮')
    })
    await closeDrawer(page)

    if (res.label === '1366') {
      console.log('  CSV...')
      await verifyCsvDownload(page, 'phones')
    }

    // —— 电子秤管理 ——
    console.log('电子秤管理...')
    await page.goto(`${BASE_URL}/it/scales`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `admin-scales-${res.label}`, async () => {
      await assertTableHasRows(page, 'Scales')
      await assertButtonExists(page, '新增', 'Scales 新增')
      await assertButtonExists(page, '导出', 'Scales 导出')
      await assertButtonExists(page, '编辑', 'Scales 编辑')
      await assertButtonExists(page, '删除', 'Scales 删除')
    })

    console.log('  Drawer...')
    await openDrawer(page)
    await verifiedShot(page, `admin-scales-drawer-${res.label}`, async () => {
      await assertDrawerOpen(page, 'Scales Drawer')
      await assertDrawerCopyButtons(page, 'Scales Drawer 复制按钮')
    })
    await closeDrawer(page)

    if (res.label === '1366') {
      console.log('  CSV...')
      await verifyCsvDownload(page, 'scales')
    }

    // —— 小程序管理 ——
    console.log('小程序管理...')
    await page.goto(`${BASE_URL}/it/miniapps`)
    await page.waitForSelector('.card-grid, .el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // 卡片视图（默认）
    await verifiedShot(page, `admin-miniapps-card-${res.label}`, async () => {
      const cards = await page.$$('.service-card')
      assert(cards.length > 0, `Miniapps 卡片视图: ${cards.length} 个卡片`)
      await assertCardEditDelete(page, 'Miniapps 卡片')
      await assertNoCardTestValues(page, 'Miniapps 卡片视图')
    })

    // 卡片 Drawer
    console.log('  Card Drawer...')
    await openCardDrawer(page)
    await verifiedShot(page, `admin-miniapps-drawer-${res.label}`, async () => {
      await assertDrawerOpen(page, 'Miniapps Drawer')
      await assertDrawerCopyButtons(page, 'Miniapps Drawer 复制按钮')
    })
    await closeDrawer(page)

    // 列表视图
    console.log('  List view...')
    await page.locator('.view-switcher').getByText('列表管理').click()
    await page.waitForTimeout(1500)
    // 选中第一行以触发批量操作栏
    const checkbox = await page.$('.el-table__row:first-child .el-checkbox')
    if (checkbox) {
      await checkbox.click()
      await page.waitForTimeout(500)
    }
    await verifiedShot(page, `admin-miniapps-list-${res.label}`, async () => {
      const table = await page.$('.el-table')
      assert(table, 'Miniapps 列表视图: 表格存在')
      await assertButtonExists(page, '编辑', 'Miniapps 列表 编辑')
      await assertButtonExists(page, '删除', 'Miniapps 列表 删除')
      await assertButtonExists(page, '批量复制', 'Miniapps 列表 批量复制')
      await assertButtonExists(page, '批量删除', 'Miniapps 列表 批量删除')
    })

    if (res.label === '1366') {
      console.log('  CSV...')
      await verifyCsvDownload(page, 'miniapps')
    }

    // 退出
    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(500)
    await page.close()
  }
}

// ===== Viewer flow =====
async function viewerFlow(browser) {
  for (const res of RESOLUTIONS) {
    const page = await browser.newPage({ viewport: { width: res.w, height: res.h } })
    console.log(`\n=== 查看者 @ ${res.w}×${res.h} ===`)
    await login(page, VIEWER_USER, VIEWER_PASS)
    await assertRole(page, '查看者', `Viewer@${res.label}`)

    // —— 电脑管理 ——
    console.log('电脑管理...')
    await page.goto(`${BASE_URL}/it/computers`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `viewer-computers-${res.label}`, async () => {
      await assertTableHasRows(page, 'Viewer Computers')
      await assertButtonNotExists(page, '新增', 'Viewer Computers 无新增')
      await assertButtonNotExists(page, '导出', 'Viewer Computers 无导出')
      await assertButtonNotExists(page, '编辑', 'Viewer Computers 无编辑')
      await assertButtonNotExists(page, '删除', 'Viewer Computers 无删除')
      await assertCopyableCellButtons(page, 'Viewer Computers 复制按钮')
    })

    // —— 固话管理 ——
    console.log('固话管理...')
    await page.goto(`${BASE_URL}/it/phones`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `viewer-phones-${res.label}`, async () => {
      await assertTableHasRows(page, 'Viewer Phones')
      await assertButtonNotExists(page, '新增', 'Viewer Phones 无新增')
      await assertButtonNotExists(page, '导出', 'Viewer Phones 无导出')
      await assertButtonNotExists(page, '编辑', 'Viewer Phones 无编辑')
      await assertButtonNotExists(page, '删除', 'Viewer Phones 无删除')
      await assertCopyableCellButtons(page, 'Viewer Phones 复制按钮')
    })

    // —— 电子秤管理 ——
    console.log('电子秤管理...')
    await page.goto(`${BASE_URL}/it/scales`)
    await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)
    await verifiedShot(page, `viewer-scales-${res.label}`, async () => {
      await assertTableHasRows(page, 'Viewer Scales')
      await assertButtonNotExists(page, '新增', 'Viewer Scales 无新增')
      await assertButtonNotExists(page, '导出', 'Viewer Scales 无导出')
      await assertButtonNotExists(page, '编辑', 'Viewer Scales 无编辑')
      await assertButtonNotExists(page, '删除', 'Viewer Scales 无删除')
      await assertCopyableCellButtons(page, 'Viewer Scales 复制按钮')
    })

    // —— 小程序管理 ——
    console.log('小程序管理...')
    await page.goto(`${BASE_URL}/it/miniapps`)
    await page.waitForSelector('.card-grid, .el-table, .el-empty', { timeout: 10000 })
    await page.waitForTimeout(2000)

    // 验证 Drawer 复制按钮（不截图，仅断言后关闭）
    await openCardDrawer(page)
    await assertDrawerOpen(page, 'Viewer Miniapps Drawer')
    await assertDrawerCopyButtons(page, 'Viewer Miniapps Drawer 复制按钮')
    await closeDrawer(page)

    await verifiedShot(page, `viewer-miniapps-${res.label}`, async () => {
      const cards = await page.$$('.service-card')
      assert(cards.length > 0, `Viewer Miniapps: ${cards.length} 个卡片`)
      await assertNoCardTestValues(page, 'Viewer Miniapps 卡片')
      await assertButtonNotExists(page, '新增', 'Viewer Miniapps 无新增')
      await assertButtonNotExists(page, '导出', 'Viewer Miniapps 无导出')
      // 卡片不应有编辑/删除（canEdit=false）
      const cardActions = await page.evaluate(() => {
        const card = document.querySelector('.service-card')
        if (!card) return { edit: false, delete: false }
        const text = card.textContent || ''
        return { edit: text.includes('编辑'), delete: text.includes('删除') }
      })
      assert(!cardActions.edit, 'Viewer Miniapps: 卡片无编辑按钮')
      assert(!cardActions.delete, 'Viewer Miniapps: 卡片无删除按钮')
    })

    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(500)
    await page.close()
  }
}

// ===== Main =====
async function main() {
  // Validate environment variables
  const missing = []
  if (!ADMIN_USER) missing.push('ADMIN_USER')
  if (!ADMIN_PASS) missing.push('ADMIN_PASS')
  if (!VIEWER_USER) missing.push('VIEWER_USER')
  if (!VIEWER_PASS) missing.push('VIEWER_PASS')
  if (missing.length > 0) {
    console.error(`FAIL: 缺少环境变量: ${missing.join(', ')}`)
    process.exit(1)
  }

  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    console.error(`安全中止：BASE_URL (${BASE_URL}) 不是 localhost`)
    process.exit(1)
  }

  // Clean old screenshots
  mkdirSync(OUT_DIR, { recursive: true })
  for (const f of readdirSync(OUT_DIR)) {
    if (f.endsWith('.png') || f.endsWith('.csv') || f === 'csv-verification.log') {
      try { unlinkSync(join(OUT_DIR, f)) } catch {}
    }
  }

  const browser = await chromium.launch({ headless: true })

  try {
    await adminFlow(browser)
    await viewerFlow(browser)
  } finally {
    await browser.close()
  }

  // Write CSV verification log
  writeFileSync(CSV_LOG, csvLogLines.join('\n') + '\n', 'utf-8')

  console.log(`\n=== 验收完成 ===`)
  console.log(`截图: ${shotCount} 张`)
  console.log(`CSV 验证日志: ${CSV_LOG}`)
  console.log(`输出目录: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('\n' + '='.repeat(60))
  console.error('验收失败:', err.message)
  console.error('='.repeat(60))
  process.exit(1)
})
