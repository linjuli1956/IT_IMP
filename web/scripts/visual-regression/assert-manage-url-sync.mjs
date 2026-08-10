// @ts-nocheck
/**
 * Playwright DOM 断言：编辑管理地址后 href 变更验证
 *
 * 验证内容：
 * 1. 保存前读取 Drawer 中"打开管理地址"链接的 href
 * 2. 编辑管理地址并保存
 * 3. 保存后读取 href，确认已更新为新 URL
 * 4. 断言页面只显示"打开管理地址"文本，不泄露长 URL
 * 5. 恢复原始管理地址后，断言 href 恢复原值
 *
 * 安全要求：
 * - 凭据通过环境变量注入，不硬编码
 * - 仅允许 localhost 目标
 * - 必须设置 CONFIRM_E2E_FIXTURE_WRITE=YES
 * - 仅操作 __e2e_server__ 前缀的测试数据
 * - 数据恢复在 finally 块中，任何异常都恢复
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3999"
 *   $env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."
 *   $env:CONFIRM_E2E_FIXTURE_WRITE="YES"
 *   node scripts/visual-regression/assert-manage-url-sync.mjs
 */
import { chromium } from 'playwright'
import { requireE2EEnv, E2E_PREFIX } from './e2e-security.mjs'

const { BASE_URL, LOGIN_USER, LOGIN_PASS } = requireE2EEnv()

/** E2E 测试目标宿主名称 */
const TARGET_HOST = `${E2E_PREFIX}esxi_host`

async function login(page) {
  await page.goto(`${BASE_URL}/login`)
  await page.fill('input[placeholder*="账号"], input[type="text"]', LOGIN_USER)
  await page.fill('input[placeholder*="密码"], input[type="password"]', LOGIN_PASS)
  await page.click('button[type="submit"], button:has-text("登录")')
  await page.waitForURL(/\/dashboard|\/it\//, { timeout: 10000 })
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

  // 跟踪是否已修改数据，用于 finally 块中恢复
  let modifiedData = false
  let originalManageUrl = null

  try {
    console.log('1. 登录...')
    await login(page)

    console.log('2. 导航到服务器管理...')
    await page.goto(`${BASE_URL}/it/servers`)
    await page.waitForSelector('.server-card-grid, .el-table', { timeout: 10000 })
    await page.waitForTimeout(2000)

    console.log(`3. 点击 E2E 测试宿主卡片 (${TARGET_HOST}) 打开 Drawer...`)
    const hostCard = page.locator('.server-card-grid').locator(`text=${TARGET_HOST}`).first()
    if (await hostCard.count() === 0) {
      throw new Error(`未找到 E2E 测试宿主卡片：${TARGET_HOST}（请先运行 rebuild-test-data.mjs）`)
    }
    await hostCard.click()
    await page.waitForTimeout(1000)

    console.log('4. 读取保存前的管理地址 href...')
    const manageLink = page.locator('.el-drawer a:has-text("打开管理地址")').first()
    if (await manageLink.count() === 0) {
      throw new Error('Drawer 中未找到"打开管理地址"链接')
    }
    const oldHref = await manageLink.getAttribute('href')
    console.log(`   旧 href: ${oldHref}`)

    // 断言 1：链接文本是"打开管理地址"，不泄露长 URL
    const linkText = await manageLink.textContent()
    console.log(`   链接文本: "${linkText}"`)
    if (linkText.trim() !== '打开管理地址') {
      throw new Error(`链接文本应为"打开管理地址"，实际为"${linkText.trim()}"`)
    }
    console.log('   ✓ 断言 1 通过：链接文本正确，不泄露长 URL')

    console.log('5. 点击"编辑"按钮...')
    await page.locator('.el-drawer button:has-text("编辑")').click()
    await page.waitForTimeout(500)

    console.log('6. 修改管理地址...')
    const inputs = page.locator('.el-dialog .el-form-item:has(label:has-text("管理地址")) input')
    const currentVal = await inputs.inputValue()
    console.log(`   当前管理地址: ${currentVal}`)
    originalManageUrl = currentVal
    const newUrl = currentVal + '#assert-test'
    await inputs.fill(newUrl)
    await page.waitForTimeout(200)

    console.log('7. 点击"保存"...')
    await page.locator('.el-dialog button:has-text("保存")').click()
    await page.waitForTimeout(2000)
    modifiedData = true

    console.log('8. 读取保存后的管理地址 href...')
    const newManageLink = page.locator('.el-drawer a:has-text("打开管理地址")').first()
    if (await newManageLink.count() === 0) {
      throw new Error('保存后 Drawer 中未找到"打开管理地址"链接')
    }
    const newHref = await newManageLink.getAttribute('href')
    console.log(`   新 href: ${newHref}`)

    // 断言 2：href 已更新（旧 ≠ 新）
    if (newHref === oldHref) {
      throw new Error(`href 未更新（旧=${oldHref}, 新=${newHref}）`)
    }
    console.log('   ✓ 断言 2 通过：href 已从旧 URL 更新为新 URL')

    // 断言 3：新 href 包含 #assert-test 标记
    if (!newHref.includes('#assert-test')) {
      throw new Error(`新 href 不包含预期标记（${newHref}）`)
    }
    console.log('   ✓ 断言 3 通过：新 href 包含预期标记')

    // 断言 4：链接文本仍为"打开管理地址"
    const newLinkText = await newManageLink.textContent()
    if (newLinkText.trim() !== '打开管理地址') {
      throw new Error(`保存后链接文本应为"打开管理地址"，实际为"${newLinkText.trim()}"`)
    }
    console.log('   ✓ 断言 4 通过：保存后链接文本仍为"打开管理地址"，不泄露长 URL')

    console.log('\n=========================================')
    console.log('✅ 全部 DOM 断言通过（保存阶段）：')
    console.log('   1. 链接文本始终为"打开管理地址"，不泄露长 URL')
    console.log('   2. 保存前 href ≠ 保存后 href（URL 已更新）')
    console.log('   3. 新 href 包含 #assert-test 标记')
    console.log('   4. 保存后链接文本仍为"打开管理地址"')
    console.log('=========================================')
  } finally {
    // 无论断言成功或失败，都尝试恢复原始管理地址
    if (modifiedData && originalManageUrl !== null) {
      console.log('\n恢复原始管理地址...')
      try {
        await page.locator('.el-drawer button:has-text("编辑")').click()
        await page.waitForTimeout(500)
        const restoreInput = page.locator('.el-dialog .el-form-item:has(label:has-text("管理地址")) input')
        await restoreInput.fill(originalManageUrl)
        await page.locator('.el-dialog button:has-text("保存")').click()
        await page.waitForTimeout(2000)
        console.log('   ✓ 已恢复原始管理地址')

        // 断言 5：恢复后 href 恢复原值
        const restoredLink = page.locator('.el-drawer a:has-text("打开管理地址")').first()
        if (await restoredLink.count() > 0) {
          const restoredHref = await restoredLink.getAttribute('href')
          if (restoredHref === originalManageUrl) {
            console.log(`   ✓ 断言 5 通过：恢复后 href 已恢复原值 (${restoredHref})`)
          } else {
            console.error(`   ⚠ 断言 5 失败：恢复后 href (${restoredHref}) ≠ 原值 (${originalManageUrl})`)
          }
        }
      } catch (restoreErr) {
        console.error('   ⚠ 恢复失败！管理地址可能仍为测试值，请手动检查：', restoreErr.message)
      }
    }
    await browser.close()
  }
}

main().catch((err) => {
  console.error('✗ 断言失败:', err.message || err)
  process.exit(1)
})
