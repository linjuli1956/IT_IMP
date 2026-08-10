/**
 * Playwright 精确 viewport 截图脚本
 * 输出：screenshots/ 目录下 7 张截图
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots');

// 确保截图目录存在
if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // 直接 API 调用获取 token，写入 localStorage
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
  }, { username: 'admin', password: '123456' });

  console.log('  API 登录:', result.success ? '成功' : '失败 - ' + result.error);
  if (!result.success) throw new Error('Login failed: ' + result.error);

  // 导航到首页
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
}

async function run() {
  const browser = await chromium.launch({ headless: true });

  // ===== 1366×768 =====
  console.log('[1366x768] 启动上下文...');
  const ctx1366 = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const p1366 = await ctx1366.newPage();
  await login(p1366);

  // 首页 1366 正常
  console.log('[1366x768] 首页正常态...');
  await p1366.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p1366.waitForTimeout(2000);
  await p1366.screenshot({ path: path.join(SHOT_DIR, 'homepage-1366-normal.png'), fullPage: true });
  console.log('  -> homepage-1366-normal.png');

  // 用户页 1366 正常
  console.log('[1366x768] 用户页正常态...');
  await p1366.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
  await p1366.waitForTimeout(1500);
  await p1366.screenshot({ path: path.join(SHOT_DIR, 'users-1366-normal.png'), fullPage: true });
  console.log('  -> users-1366-normal.png');

  // 用户页 1366 空态（搜索无结果）
  console.log('[1366x768] 用户页空态...');
  await p1366.waitForSelector('.filter-bar input', { timeout: 5000 });
  await p1366.fill('.filter-bar input', 'zzznonexistent');
  await p1366.waitForTimeout(800);
  await p1366.screenshot({ path: path.join(SHOT_DIR, 'users-1366-empty.png'), fullPage: true });
  console.log('  -> users-1366-empty.png');

  // 服务器页 1366 兼容
  console.log('[1366x768] 服务器页兼容...');
  await p1366.goto(`${BASE}/it/servers`, { waitUntil: 'networkidle' });
  await p1366.waitForTimeout(2000);
  await p1366.screenshot({ path: path.join(SHOT_DIR, 'servers-1366-compat.png'), fullPage: true });
  console.log('  -> servers-1366-compat.png');

  await ctx1366.close();

  // ===== 1440×1024 =====
  console.log('[1440x1024] 启动上下文...');
  const ctx1440 = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
  const p1440 = await ctx1440.newPage();
  await login(p1440);

  // 首页 1440 正常
  console.log('[1440x1024] 首页正常态...');
  await p1440.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await p1440.waitForTimeout(2000);
  await p1440.screenshot({ path: path.join(SHOT_DIR, 'homepage-1440-normal.png'), fullPage: true });
  console.log('  -> homepage-1440-normal.png');

  // 用户页 1440 正常
  console.log('[1440x1024] 用户页正常态...');
  await p1440.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
  await p1440.waitForTimeout(1500);
  await p1440.screenshot({ path: path.join(SHOT_DIR, 'users-1440-normal.png'), fullPage: true });
  console.log('  -> users-1440-normal.png');

  await ctx1440.close();

  // ===== 加载态 =====
  console.log('[1366x768] 首页加载态...');
  const ctxLoad = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const pLoad = await ctxLoad.newPage();
  await login(pLoad);

  // 拦截 API 请求延迟 3 秒
  await pLoad.route('**/api/**', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    await route.continue();
  });

  // 导航到首页，立即截图（加载态可见）
  await pLoad.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pLoad.waitForTimeout(500);
  await pLoad.screenshot({ path: path.join(SHOT_DIR, 'homepage-1366-loading.png'), fullPage: true });
  console.log('  -> homepage-1366-loading.png');

  await ctxLoad.close();
  await browser.close();

  // ===== 输出文件尺寸 =====
  console.log('\n=== 截图文件验证 ===');
  const files = [
    'homepage-1366-normal.png',
    'homepage-1440-normal.png',
    'homepage-1366-loading.png',
    'users-1366-normal.png',
    'users-1440-normal.png',
    'users-1366-empty.png',
    'servers-1366-compat.png',
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
