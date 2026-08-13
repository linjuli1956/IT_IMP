// @ts-nocheck
/**
 * 服务器页面"更多"菜单移除 — 验收截图脚本
 *
 * 拍摄内容：
 * 1. 管理员：卡片模式（编辑/删除文字按钮）
 * 2. 管理员：Drawer Footer（平铺操作）
 * 3. 查看者：卡片模式（无编辑/删除）
 * 4. 查看者：Drawer Footer（仅关闭/详情/管理）
 *
 * 用法：
 *   $env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."; node scripts/visual-regression/screenshot-server-more-removal.cjs
 *   $env:VIEWER_USERNAME="viewer"; $env:VIEWER_PASSWORD="..."; node scripts/visual-regression/screenshot-server-more-removal.cjs
 */
const { chromium } = require('playwright')
const { mkdirSync } = require('node:fs')
const { join } = require('node:path')

const BASE_URL = process.env.BASE_URL || 'http://localhost:3999'
const ADMIN_USER = process.env.LOGIN_USER
const ADMIN_PASS = process.env.LOGIN_PASS
const VIEWER_USER = process.env.VIEWER_USERNAME
const VIEWER_PASS = process.env.VIEWER_PASSWORD
const OUT_DIR = join(process.cwd(), 'scripts', 'visual-regression', 'screenshots', 'more-removal')

async function login(page, user, pass) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('.login-form', { timeout: 10000 })
  await page.fill('input[placeholder="请输入用户名"]', user)
  await page.fill('input[placeholder="请输入密码"]', pass)
  await page.click('.login-btn')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 })
}

async function screenshot(page, name) {
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log(`  ✓ ${name}.png`)
}

async function main() {
  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    console.error(`安全中止：BASE_URL (${BASE_URL}) 不是 localhost`)
    process.exit(1)
  }

  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // ===== 管理员截图 =====
  if (ADMIN_USER && ADMIN_PASS) {
    console.log('管理员登录...')
    await login(page, ADMIN_USER, ADMIN_PASS)

    console.log('导航到服务器管理...')
    await page.goto(`${BASE_URL}/it/servers`)
    await page.waitForSelector('.server-card-grid, .el-table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    console.log('管理员截图：')
    // 卡片模式 — 验证编辑/删除文字按钮
    await screenshot(page, 'admin-card-flat-actions')

    // 打开第一个卡片 Drawer — 验证 Footer 平铺
    const firstCard = await page.$('.server-host-card, .server-vm-card')
    if (firstCard) {
      await firstCard.click()
      await page.waitForTimeout(1500)
      await screenshot(page, 'admin-drawer-flat-footer')
      // 关闭 Drawer
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    // 物理机 Tab
    await page.click('.tab-group .el-radio-button:has-text("物理机") input, .tab-group label:has-text("物理机")')
    await page.waitForTimeout(1500)
    await screenshot(page, 'admin-physical-card-flat-actions')

    // 打开物理机 Drawer
    const physCard = await page.$('.server-host-card')
    if (physCard) {
      await physCard.click()
      await page.waitForTimeout(1500)
      await screenshot(page, 'admin-physical-drawer-flat-footer')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    // 虚拟机 Tab
    await page.click('.tab-group .el-radio-button:has-text("虚拟机") input, .tab-group label:has-text("虚拟机")')
    await page.waitForTimeout(1500)
    await screenshot(page, 'admin-vm-card-flat-actions')

    // 打开虚拟机 Drawer
    const vmCard = await page.$('.server-vm-card')
    if (vmCard) {
      await vmCard.click()
      await page.waitForTimeout(1500)
      await screenshot(page, 'admin-vm-drawer-flat-footer')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
    }

    // 退出登录
    await page.goto(`${BASE_URL}/login`)
    await page.waitForTimeout(1000)
  } else {
    console.log('跳过管理员截图（未设置 LOGIN_USER / LOGIN_PASS）')
  }

  // ===== 查看者截图 =====
  if (VIEWER_USER && VIEWER_PASS) {
    console.log('查看者登录...')
    await login(page, VIEWER_USER, VIEWER_PASS)

    console.log('导航到服务器管理...')
    await page.goto(`${BASE_URL}/it/servers`)
    await page.waitForSelector('.server-card-grid, .el-table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    console.log('查看者截图：')
    // 卡片模式 — 验证无编辑/删除
    await screenshot(page, 'viewer-card-no-actions')

    // 打开 Drawer — 验证仅关闭/详情/管理
    const firstCard = await page.$('.server-host-card, .server-vm-card')
    if (firstCard) {
      await firstCard.click()
      await page.waitForTimeout(1500)
      await screenshot(page, 'viewer-drawer-limited-footer')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)
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
