/**
 * Batch 3 截图：IT资产列表页 (computers + network-devices + phones + scales + miniapps)
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'batch3');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
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
  }, { username: 'admin', password: '123456' });

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

  const pages = [
    { url: '/it/computers', name: 'computers-1366.png', label: '电脑管理' },
    { url: '/it/network-devices', name: 'network-devices-1366.png', label: '网络设备' },
    { url: '/it/phones', name: 'phones-1366.png', label: '固话管理' },
    { url: '/it/scales', name: 'scales-1366.png', label: '电子称管理' },
    { url: '/it/miniapps', name: 'miniapps-1366.png', label: '小程序管理' },
  ];

  for (const p of pages) {
    console.log(`[1366x768] ${p.label}...`);
    await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOT_DIR, p.name), fullPage: true });
    console.log(`  -> ${p.name}`);
  }

  await ctx.close();
  await browser.close();

  console.log('\n=== 截图文件验证 ===');
  let allOk = true;
  for (const p of pages) {
    const fp = path.join(SHOT_DIR, p.name);
    if (fs.existsSync(fp)) {
      const stat = fs.statSync(fp);
      const kb = (stat.size / 1024).toFixed(1);
      console.log(`  OK  ${p.name}  ${kb} KB`);
    } else {
      console.log(`  FAIL ${p.name}  NOT FOUND`);
      allOk = false;
    }
  }
  console.log(allOk ? '\n所有截图验证通过' : '\n部分截图缺失');
}

run().catch(err => {
  console.error('截图脚本失败:', err);
  process.exit(1);
});
