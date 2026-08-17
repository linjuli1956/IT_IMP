/**
 * 最终验收截图：全项目关键页面真实数据态 + 空态
 * 1366×768，Playwright headless
 * 含校验：pathname、关键元素、404/error-page 检测
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'final');

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

/**
 * 校验截图：不仅要求 PNG 生成，还必须通过内容校验
 * - pathname 与预期一致（未被重定向到 /login 或 404）
 * - 页面不含 404 / error-page 标记
 * - 关键元素存在（PageHeader 或表格或空态组件）
 * 返回 { ok, reason }
 */
async function shot(page, name, label, expectedPath) {
  console.log(`[1366x768] ${label}...`);
  await page.waitForTimeout(1800);

  // 1. pathname 校验
  const actualPath = new URL(page.url()).pathname;
  if (expectedPath && actualPath !== expectedPath) {
    return { ok: false, reason: `pathname mismatch: expected ${expectedPath}, got ${actualPath}` };
  }

  // 2. 404 / error-page 检测
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
  const has404 = /404|page-not-found|error-page|Not Found/i.test(bodyText);
  if (has404) {
    return { ok: false, reason: 'page contains 404/error-page indicator' };
  }

  // 3. 关键元素检测（PageHeader / el-table / EmptyState / StatCard 至少存在一个）
  const hasKeyElement = await page.evaluate(() => {
    return !!(
      document.querySelector('.page-header') ||
      document.querySelector('.el-table') ||
      document.querySelector('.empty-state') ||
      document.querySelector('.stat-card') ||
      document.querySelector('.el-empty') ||
      document.querySelector('[class*="dashboard"]')
    );
  });
  if (!hasKeyElement) {
    return { ok: false, reason: 'no key element found (page-header/el-table/empty-state/stat-card)' };
  }

  // 校验通过才截图
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
  const stat = fs.statSync(path.join(SHOT_DIR, name));
  console.log(`  -> ${name}  ${(stat.size / 1024).toFixed(1)} KB`);
  return { ok: true, reason: 'validated' };
}

// 页面清单：有数据的标记 data，无数据的标记 empty
const pages = [
  // === 系统模块 ===
  { url: '/', name: '01-home-data.png', label: '首页仪表盘' },
  { url: '/system/users', name: '02-users-data.png', label: '用户管理（1条）' },
  { url: '/system/logs', name: '03-logs-data.png', label: '操作日志（73条）' },
  { url: '/system/settings', name: '04-settings-data.png', label: '系统设置' },

  // === 配置模块 ===
  { url: '/config/stores', name: '05-stores-data.png', label: '门店管理（1条）' },
  { url: '/config/suppliers', name: '06-suppliers-empty.png', label: '客户管理（空态）' },
  { url: '/config/fee-schemes', name: '07-fee-schemes-empty.png', label: '费用分摊方案（空态）' },
  { url: '/config/templates', name: '08-templates-empty.png', label: '计提模板（空态）' },

  // === IT资产 ===
  { url: '/it/computers', name: '09-computers-data.png', label: '电脑管理（1条）' },
  { url: '/it/network-devices', name: '10-network-devices-data.png', label: '网络设备（1条）' },
  { url: '/it/phones', name: '11-phones-data.png', label: '固话管理（1条）' },
  { url: '/it/scales', name: '12-scales-data.png', label: '电子称（3条）' },
  { url: '/it/miniapps', name: '13-miniapps-data.png', label: '小程序（1条）' },
  { url: '/it/domains', name: '14-domains-data.png', label: '域名管理（1条）' },
  { url: '/it/servers', name: '15-servers-data.png', label: '服务器列表（6台）' },
  { url: '/it/servers/7', name: '16-server-detail-data.png', label: '服务器详情（id=7）' },

  // === 发票/批次 ===
  { url: '/invoices/list', name: '17-invoices-empty.png', label: '发票列表（空态）' },
  { url: '/invoices/batches', name: '18-batches-empty.png', label: '批次列表（空态）' },

  // === 计提/明细 ===
  { url: '/accruals', name: '19-accruals-empty.png', label: '计提表列表（空态）' },
  { url: '/details', name: '20-details-empty.png', label: '明细表管理（空态）' },

  // === 合同/支付/预算 ===
  { url: '/contracts', name: '21-contracts-empty.png', label: '合同管理（空态）' },
  { url: '/payment', name: '22-payment-data.png', label: '支付管理（1条）' },
  { url: '/budget', name: '23-budget-data.png', label: '预算管理（1条）' },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();
  await login(page);

  const results = [];
  for (const p of pages) {
    await page.goto(`${BASE}${p.url}`, { waitUntil: 'networkidle' });
    const expectedPath = new URL(`${BASE}${p.url}`).pathname;
    const r = await shot(page, p.name, p.label, expectedPath);
    results.push({ ...p, ...r });
    if (!r.ok) console.log(`  !! 校验失败: ${r.reason}`);
  }

  await ctx.close();
  await browser.close();

  console.log('\n=== 最终验收截图验证 ===');
  let allOk = true;
  for (const r of results) {
    const fp = path.join(SHOT_DIR, r.name);
    const exists = fs.existsSync(fp);
    const stat = exists ? fs.statSync(fp) : null;
    const kb = stat ? (stat.size / 1024).toFixed(1) : 'N/A';
    const status = r.ok && exists ? 'OK  ' : 'FAIL';
    if (!r.ok || !exists) allOk = false;
    console.log(`  ${status} ${r.name}  ${kb} KB  ${r.ok ? '' : '- ' + r.reason}`);
  }
  console.log(allOk ? '\n所有截图验证通过' : '\n部分截图校验失败，请检查上方日志');
  if (!allOk) process.exit(1);
}

run().catch(err => {
  console.error('截图脚本失败:', err);
  process.exit(1);
});
