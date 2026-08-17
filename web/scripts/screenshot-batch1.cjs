/**
 * Batch 1 截图：系统模块 (logs + settings)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'batch1');

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

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await login(page);

  // 操作日志页
  console.log('[1366x768] 操作日志页...');
  await page.goto(`${BASE}/system/logs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'logs-1366.png'), fullPage: true });
  console.log('  -> logs-1366.png');

  // 系统设置页
  console.log('[1366x768] 系统设置页...');
  await page.goto(`${BASE}/system/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'settings-1366.png'), fullPage: true });
  console.log('  -> settings-1366.png');

  await ctx.close();
  await browser.close();

  // 验证文件
  console.log('\n=== 截图文件验证 ===');
  const files = ['logs-1366.png', 'settings-1366.png'];
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
