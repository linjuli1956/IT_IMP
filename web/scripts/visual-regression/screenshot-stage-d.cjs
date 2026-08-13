// @ts-nocheck
/**
 * 阶段 D — 资产页面统一落地批次 验收截图脚本
 *
 * 拍摄内容（4 页 × 2 分辨率）：
 *   电脑 / 固话 / 电子秤：管理员正常态、Drawer、查看者态
 *   小程序：管理员卡片态、管理员列表态、Drawer、查看者态
 *
 * 用法：
 *   $env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."; node scripts/visual-regression/screenshot-stage-d.cjs
 *   $env:VIEWER_USERNAME="viewer"; $env:VIEWER_PASSWORD="..."; node scripts/visual-regression/screenshot-stage-d.cjs
 */
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999'
const ADMIN_USER = process.env.LOGIN_USER
const ADMIN_PASS = process.env.LOGIN_PASS
const VIEWER_USER = process.env.VIEWER_USERNAME
const VIEWER_PASS = process.env.VIEWER_PASSWORD
const OUT_DIR = join(process.cwd(), 'scripts', 'visual-regression', 'screenshots', 'stage-d')

const RESOLUTIONS = [
  { w: 1366, h: 768, label: '1366' },
  { w: 1440, h: 1024, label: '1440' },
]

async function login(page, user, pass) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('.login-form', { timeout: 10000 })
  await page.fill('input[placeholder="请输入用户名"]', user)
  await page.fill('input[placeholder="请输入密码"]', pass)
  await page.click('.login-btn')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

async function shot(page, name) {
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log(`  ✓ ${name}.png`)
}

async function openFirstRowDrawer(page) {
  const row = await page.$('.el-table__row')
  if (row) {
    await row.click()
    await page.waitForTimeout(1500)
    return true
  }
  return false
}

async function closeDrawer(page) {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

async function main() {
  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    console.error(`安全中止：BASE_URL (${BASE_URL}) 不是 localhost`)
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  // ===== 管理员截图 =====
  if (ADMIN_USER && ADMIN_PASS) {
    for (const res of RESOLUTIONS) {
      const page = await browser.newPage({ viewport: { width: res.w, height: res.h } })
      console.log(`\n=== 管理员 @ ${res.w}×${res.h} ===`)
      await login(page, ADMIN_USER, ADMIN_PASS)

      // —— 电脑管理 ——
      console.log('电脑管理...')
      await page.goto(`${BASE_URL}/it/computers`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `admin-computers-${res.label}`)

      if (await openFirstRowDrawer(page)) {
        await shot(page, `admin-computers-drawer-${res.label}`)
        await closeDrawer(page)
      }

      // —— 固话管理 ——
      console.log('固话管理...')
      await page.goto(`${BASE_URL}/it/phones`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `admin-phones-${res.label}`)

      if (await openFirstRowDrawer(page)) {
        await shot(page, `admin-phones-drawer-${res.label}`)
        await closeDrawer(page)
      }

      // —— 电子秤管理 ——
      console.log('电子秤管理...')
      await page.goto(`${BASE_URL}/it/scales`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `admin-scales-${res.label}`)

      if (await openFirstRowDrawer(page)) {
        await shot(page, `admin-scales-drawer-${res.label}`)
        await closeDrawer(page)
      }

      // —— 小程序管理 ——
      console.log('小程序管理...')
      await page.goto(`${BASE_URL}/it/miniapps`)
      await page.waitForSelector('.card-grid, .el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)

      // 卡片视图（默认）
      await shot(page, `admin-miniapps-card-${res.label}`)

      // 打开卡片 Drawer
      const firstCard = await page.$('.service-card')
      if (firstCard) {
        await firstCard.click()
        await page.waitForTimeout(1500)
        await shot(page, `admin-miniapps-drawer-${res.label}`)
        await closeDrawer(page)
      }

      // 列表视图
      const listBtn = await page.$('.view-switcher .el-radio-button:has-text("列表管理") input, .view-switcher label:has-text("列表管理")')
      if (listBtn) {
        await listBtn.click()
        await page.waitForTimeout(1500)
        await shot(page, `admin-miniapps-list-${res.label}`)
      }

      // 退出
      await page.goto(`${BASE_URL}/login`)
      await page.waitForTimeout(1000)
      await page.close()
    }
  } else {
    console.log('跳过管理员截图（未设置 LOGIN_USER / LOGIN_PASS）')
  }

  // ===== 查看者截图 =====
  if (VIEWER_USER && VIEWER_PASS) {
    for (const res of RESOLUTIONS) {
      const page = await browser.newPage({ viewport: { width: res.w, height: res.h } })
      console.log(`\n=== 查看者 @ ${res.w}×${res.h} ===`)
      await login(page, VIEWER_USER, VIEWER_PASS)

      // —— 电脑管理 ——
      console.log('电脑管理...')
      await page.goto(`${BASE_URL}/it/computers`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `viewer-computers-${res.label}`)

      // —— 固话管理 ——
      console.log('固话管理...')
      await page.goto(`${BASE_URL}/it/phones`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `viewer-phones-${res.label}`)

      // —— 电子秤管理 ——
      console.log('电子秤管理...')
      await page.goto(`${BASE_URL}/it/scales`)
      await page.waitForSelector('.el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `viewer-scales-${res.label}`)

      // —— 小程序管理 ——
      console.log('小程序管理...')
      await page.goto(`${BASE_URL}/it/miniapps`)
      await page.waitForSelector('.card-grid, .el-table, .el-empty', { timeout: 10000 })
      await page.waitForTimeout(2000)
      await shot(page, `viewer-miniapps-${res.label}`)

      await page.goto(`${BASE_URL}/login`)
      await page.waitForTimeout(1000)
      await page.close()
    }
  } else {
    console.log('跳过查看者截图（未设置 VIEWER_USERNAME / VIEWER_PASSWORD）')
  }

  await browser.close()
  console.log(`\n截图已保存到 ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('截图失败:', err)
  process.exit(1)
})
