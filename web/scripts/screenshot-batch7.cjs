/**
 * Batch 7 截图：计提列表 + 明细列表（正常态/空态）+ 详情不存在页 EmptyState
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'batch7');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// ——— 管理员账户（环境变量，不硬编码）——
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('错误：需要环境变量 ADMIN_USERNAME 和 ADMIN_PASSWORD（不内置默认凭据）');
  process.exit(1);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const result = await page.evaluate(async (creds) => {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(creds),
    });
    const data = await resp.json();
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      return { success: true };
    }
    return { success: false, error: data.message || 'Unknown' };
  }, { username: ADMIN_USERNAME, password: ADMIN_PASSWORD });

  console.log('  API 登录:', result.success ? '成功' : '失败 - ' + result.error);
  if (!result.success) throw new Error('Login failed: ' + result.error);

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

async function shot(page, name, label) {
  console.log(`[1366x768] ${label}...`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
  console.log(`  -> ${name}`);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await login(page);

  // 1. 计提列表正常态
  await page.goto(`${BASE}/accruals`, { waitUntil: 'networkidle' });
  await shot(page, 'accruals-normal-1366.png', '计提列表正常态');

  // 2. 计提列表空态 — 用费用月筛选 "2099-01" 确保无匹配
  await page.goto(`${BASE}/accruals`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  // 找到费用月 date-picker 输入框并填入
  const feeMonthInputs = page.locator('.el-date-editor input');
  const count = await feeMonthInputs.count();
  if (count >= 1) {
    // accruals 页面只有一个 date-picker（费用月）
    await feeMonthInputs.first().click();
    await page.waitForTimeout(300);
    await feeMonthInputs.first().fill('2099-01');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    // 点击页面其他位置关闭 date picker 面板
    await page.locator('.page-container').first().click();
    await page.waitForTimeout(500);
  }
  await shot(page, 'accruals-empty-1366.png', '计提列表空态');

  // 3. 明细列表正常态
  await page.goto(`${BASE}/details`, { waitUntil: 'networkidle' });
  await shot(page, 'details-normal-1366.png', '明细列表正常态');

  // 4. 明细列表空态 — 同样用费用月筛选
  await page.goto(`${BASE}/details`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const detailFeeInputs = page.locator('.filter-form .el-date-editor input');
  const dCount = await detailFeeInputs.count();
  if (dCount >= 1) {
    await detailFeeInputs.first().click();
    await page.waitForTimeout(300);
    await detailFeeInputs.first().fill('2099-01');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await page.locator('.page-container').first().click();
    await page.waitForTimeout(500);
  }
  await shot(page, 'details-empty-1366.png', '明细列表空态');

  // 5. 详情不存在页 EmptyState
  await page.goto(`${BASE}/accruals/99999`, { waitUntil: 'networkidle' });
  await shot(page, 'accruals-notfound-1366.png', '计提详情不存在 EmptyState');

  await ctx.close();
  await browser.close();

  // 验证
  console.log('\n=== 截图文件验证 ===');
  const files = [
    'accruals-normal-1366.png',
    'accruals-empty-1366.png',
    'details-normal-1366.png',
    'details-empty-1366.png',
    'accruals-notfound-1366.png',
  ];
  let allOk = true;
  for (const f of files) {
    const fp = path.join(SHOT_DIR, f);
    if (fs.existsSync(fp)) {
      const stat = fs.statSync(fp);
      const kb = (stat.size / 1024).toFixed(1);
      console.log(`  OK  ${f}  ${kb} KB`);
    } else {
      console.log(`  FAIL ${f}  NOT FOUND`);
      allOk = false;
    }
  }
  console.log(allOk ? '\n所有截图验证通过' : '\n部分截图缺失');
}

run().catch(err => {
  console.error('截图脚本失败:', err);
  process.exit(1);
});
