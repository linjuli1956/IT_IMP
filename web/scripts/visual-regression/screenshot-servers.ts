// @ts-nocheck
/**
 * 服务器管理页面视觉回归截图脚本
 *
 * 使用 Playwright 对 /it/servers 页面截图：
 * - 全部 Tab 卡片模式
 * - 物理机 Tab 卡片模式
 * - 虚拟机 Tab 卡片模式
 * - 树形列表模式
 *
 * 用法：
 *   npx playwright install chromium   # 首次安装浏览器
 *   npx tsx scripts/visual-regression/screenshot-servers.ts
 *
 * 环境变量：
 *   BASE_URL   — 页面根地址（默认 http://localhost:3999）
 *   LOGIN_USER — 登录用户名（必须设置，不硬编码）
 *   LOGIN_PASS — 登录密码（必须设置，不硬编码）
 */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { requireE2EReadonly } from './e2e-security.mjs'

const { BASE_URL, LOGIN_USER, LOGIN_PASS } = requireE2EReadonly()
const OUT_DIR = join(process.cwd(), 'scripts', 'visual-regression', 'screenshots')

async function login(page: import('playwright').Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[placeholder*="账号"], input[type="text"]', LOGIN_USER)
  await page.fill('input[placeholder*="密码"], input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"], button:has-text("登录")')
  await page.waitForURL(/\/dashboard|\/it\//, { timeout: 10000 })
}

async function screenshot(page: import('playwright').Page, name: string) {
  const path = join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  console.log(`  ✓ ${name}.png`)
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  console.log('登录...')
  await login(page)

  console.log('导航到服务器管理...')
  await page.goto(`${BASE_URL}/it/servers`)
  await page.waitForSelector('.server-card-grid, .el-table', { timeout: 10000 })

  // 等待数据加载
  await page.waitForTimeout(2000)

  console.log('截图：')
  // 全部 Tab 卡片模式
  await screenshot(page, 'servers-all-card')

  // 物理机 Tab 卡片模式
  await page.click('.tab-group .el-radio-button:has-text("物理机") input, .tab-group label:has-text("物理机")')
  await page.waitForTimeout(1500)
  await screenshot(page, 'servers-physical-card')

  // 虚拟机 Tab 卡片模式
  await page.click('.tab-group .el-radio-button:has-text("虚拟机") input, .tab-group label:has-text("虚拟机")')
  await page.waitForTimeout(1500)
  await screenshot(page, 'servers-virtual-card')

  // 切回全部 Tab
  await page.click('.tab-group .el-radio-button:has-text("全部") input, .tab-group label:has-text("全部")')
  await page.waitForTimeout(500)

  // 树形列表模式
  await page.click('.view-mode .el-radio-button:has-text("树形列表") input, .view-mode label:has-text("树形列表")')
  await page.waitForTimeout(1500)
  await screenshot(page, 'servers-all-tree')

  await browser.close()
  console.log(`\n截图已保存到 ${OUT_DIR}`)
}

main().catch((err) => {
  console.error('截图失败:', err)
  process.exit(1)
})
