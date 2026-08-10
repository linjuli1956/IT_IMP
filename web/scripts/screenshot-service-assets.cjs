/**
 * 服务型资产正式页面截图：it/domains + it/miniapps
 * 双视口：1366×768 与 1440×1024
 * 截图矩阵：正常态 / 到期态 / Drawer态 / 查看者态
 * Playwright headless，Mock API 响应（无需数据库）
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'service-assets');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

const viewports = [
  { width: 1366, height: 768, label: '1366' },
  { width: 1440, height: 1024, label: '1440' },
];

// —— Mock API 数据 ——
// 日期基于 2026-08-10 计算：15天后到期(红)、已过期(红)、>90天(绿)
const mockDomains = [
  { id: 1, domain: 'taixing-mart.invalid', mainAccount: 'taixingadmin@aliyun', mainPassword: 'SecRet#2026', certType: 'OV', certIssuer: '阿里云SSL', certRenewDate: '2026-02-10', certExpireDate: '2026-08-25', status: '正常', remark: '主站' },
  { id: 2, domain: 'api.taixing-mart.invalid', mainAccount: 'taixingadmin@aliyun', mainPassword: 'SecRet#2026', certType: 'DV', certIssuer: "Let's Encrypt", certRenewDate: '2026-07-20', certExpireDate: '2026-09-20', status: '正常', remark: '接口' },
  { id: 3, domain: 'hq.taixing-mart.invalid', mainAccount: 'hqadmin@aliyun', mainPassword: 'HQpass2024!', certType: 'EV', certIssuer: 'DigiCert', certRenewDate: '2025-11-01', certExpireDate: '2026-07-15', status: '正常', remark: '总部系统' },
  { id: 4, domain: 'legacy.taixing-mart.invalid', mainAccount: 'oldadmin@aliyun', mainPassword: 'Old123456', certType: 'DV', certIssuer: "Let's Encrypt", certRenewDate: '2025-11-01', certExpireDate: '2026-05-01', status: '停用', remark: '旧域名待注销' },
  { id: 5, domain: 'pay.taixing-mart.invalid', mainAccount: 'payadmin@aliyun', mainPassword: 'Pay#Secure9', certType: 'OV', certIssuer: '阿里云SSL', certRenewDate: '2026-01-01', certExpireDate: '2027-01-01', status: '正常', remark: '支付' },
];
const mockMiniapps = [
  { id: 1, name: '泰兴超市会员小程序', email: 'member@taixing-mart.invalid', emailPassword: 'Mini#Member2026', status: '正常', remark: '会员中心' },
  { id: 2, name: '泰兴购物小程序', email: 'shop@taixing-mart.invalid', emailPassword: 'Shop2026Pass', status: '正常', remark: '线上购物' },
  { id: 3, name: '泰兴员工助手', email: 'hr@taixing-mart.invalid', emailPassword: 'Hr#Internal1', status: '停用', remark: '内部应用停用' },
  { id: 4, name: '泰兴售后小程序', email: 'service@taixing-mart.invalid', emailPassword: 'Svc#2026Safe', status: '正常', remark: '' },
];

async function login(page, role = '管理员') {
  // catch-all 先注册（Playwright 后注册的优先），确保特定 API 返回正确 mock 数据
  await page.route(`${BASE}/api/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  // 特定 API 后注册（覆盖 catch-all）
  await page.route(`${BASE}/api/stores`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
  await page.route(`${BASE}/api/settings`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  await page.route(`${BASE}/api/domains`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDomains) })
  );
  await page.route(`${BASE}/api/miniapps`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockMiniapps) })
  );

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate((r) => {
    localStorage.setItem('token', 'service-assets-mock-token');
    localStorage.setItem('user_info', JSON.stringify({ id: 1, username: 'admin', name: r === '管理员' ? '管理员' : '查看者', role: r, status: '正常' }));
  }, role);
  console.log(`  注入 mock token + API 路由拦截（角色：${role}）`);
}

async function shot(page, name, label) {
  console.log(`  ${label}...`);
  await page.waitForTimeout(1500);
  const hasKey = await page.evaluate(() => {
    return !!(
      document.querySelector('.service-card') ||
      document.querySelector('.el-drawer') ||
      document.querySelector('.page-header') ||
      document.querySelector('.el-table')
    );
  });
  if (!hasKey) {
    console.log(`  !! 关键元素缺失，跳过 ${name}`);
    return { ok: false, reason: 'no key element' };
  }
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: true });
  const stat = fs.statSync(path.join(SHOT_DIR, name));
  console.log(`  -> ${name}  ${(stat.size / 1024).toFixed(1)} KB`);
  return { ok: true };
}

async function step(results, name, label, fn) {
  try {
    const r = await fn();
    results.push({ name, ...r });
  } catch (err) {
    console.log(`  !! ${label} 失败: ${err.message.slice(0, 120)}`);
    results.push({ name, ok: false, reason: err.message.slice(0, 120) });
  }
}

async function closeDrawer(page) {
  await page.locator('.el-drawer__close-btn').click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
}

async function runViewport(vp) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const results = [];
  try {
    // ===== 正常态（管理员，域名卡片网格） =====
    await login(page, '管理员');
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await step(results, `domains-${vp.label}-normal.png`, `[${vp.label}] 域名卡片态（管理员）`,
      () => shot(page, `domains-${vp.label}-normal.png`, `[${vp.label}] 域名卡片态`));

    // ===== 到期态（管理员，域名页含到期/过期标签的卡片） =====
    // Mock 数据已含 15天后到期(红)、已过期(红)、>90天(绿)，直接截图即可
    await page.waitForTimeout(500);
    await step(results, `domains-${vp.label}-expiring.png`, `[${vp.label}] 域名到期态`,
      () => shot(page, `domains-${vp.label}-expiring.png`, `[${vp.label}] 域名到期态（含到期标签）`));

    // ===== Drawer态（管理员，点击卡片打开抽屉） =====
    const card = page.locator('.service-card').first();
    await card.waitFor({ state: 'visible', timeout: 5000 });
    await card.click();
    await page.waitForTimeout(1500);
    await step(results, `domains-${vp.label}-drawer.png`, `[${vp.label}] 域名详情抽屉（敏感字段）`,
      () => shot(page, `domains-${vp.label}-drawer.png`, `[${vp.label}] 域名详情抽屉`));
    await closeDrawer(page);

    // ===== 域名列表管理态（管理员，切换到列表视图） =====
    await page.locator('.el-radio-button:has-text("列表管理")').click();
    await page.waitForTimeout(1500);
    await step(results, `domains-${vp.label}-list.png`, `[${vp.label}] 域名列表管理态（含批量操作）`,
      () => shot(page, `domains-${vp.label}-list.png`, `[${vp.label}] 域名列表管理态`));

    // ===== 域名列表筛选态（管理员，选择颁发机构筛选） =====
    const issuerSelect = page.locator('.filter-bar .el-select').nth(1); // 第二个 select = 颁发机构
    await issuerSelect.click();
    await page.waitForTimeout(300);
    const firstIssuer = page.locator('.el-select-dropdown__item').filter({ visible: true }).first();
    await firstIssuer.click();
    await page.waitForTimeout(1000);
    await step(results, `domains-${vp.label}-list-filter.png`, `[${vp.label}] 域名列表筛选态（颁发机构）`,
      () => shot(page, `domains-${vp.label}-list-filter.png`, `[${vp.label}] 域名列表筛选态`));
    // 清除筛选
    await issuerSelect.click();
    await page.waitForTimeout(300);
    await page.locator('.el-select__clear').first().click().catch(() => {});
    await page.waitForTimeout(500);

    // ===== 小程序正常态（管理员，卡片视图） =====
    await page.goto(`${BASE}/it/miniapps`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await step(results, `miniapps-${vp.label}-normal.png`, `[${vp.label}] 小程序卡片态（管理员）`,
      () => shot(page, `miniapps-${vp.label}-normal.png`, `[${vp.label}] 小程序卡片态`));

    // ===== 小程序列表管理态（管理员） =====
    await page.locator('.el-radio-button:has-text("列表管理")').click();
    await page.waitForTimeout(1500);
    await step(results, `miniapps-${vp.label}-list.png`, `[${vp.label}] 小程序列表管理态（含批量操作）`,
      () => shot(page, `miniapps-${vp.label}-list.png`, `[${vp.label}] 小程序列表管理态`));

    // ===== 查看者态（域名页，无编辑/删除按钮） =====
    // 重新登录为查看者
    await ctx.clearCookies();
    await page.evaluate(() => {
      localStorage.setItem('token', 'service-assets-mock-token');
      localStorage.setItem('user_info', JSON.stringify({ id: 2, username: 'viewer', name: '查看者', role: '查看者', status: '正常' }));
    });
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await step(results, `domains-${vp.label}-viewer.png`, `[${vp.label}] 域名查看者态（无编辑按钮）`,
      () => shot(page, `domains-${vp.label}-viewer.png`, `[${vp.label}] 域名查看者态`));

    // ===== 查看者列表态（无批量删除按钮）+ DOM 断言 =====
    await page.locator('.el-radio-button:has-text("列表管理")').click();
    await page.waitForTimeout(1500);
    // DOM 断言：查看者不能看到批量删除按钮
    const batchDeleteBtn = page.locator('.batch-bar button:has-text("批量删除")');
    const hasBatchDelete = await batchDeleteBtn.isVisible().catch(() => false);
    console.log(`  [DOM断言] 查看者批量删除按钮存在: ${hasBatchDelete} (期望 false)`);
    if (hasBatchDelete) {
      results.push({ name: `domains-${vp.label}-viewer-list.png`, ok: false, reason: '查看者看到了批量删除按钮' });
    }
    await step(results, `domains-${vp.label}-viewer-list.png`, `[${vp.label}] 域名查看者列表态（无批量删除）`,
      () => shot(page, `domains-${vp.label}-viewer-list.png`, `[${vp.label}] 域名查看者列表态`));

    // ===== 操作员列表态 DOM 断言（操作员可看到批量删除） =====
    await ctx.clearCookies();
    await page.evaluate(() => {
      localStorage.setItem('token', 'service-assets-mock-token');
      localStorage.setItem('user_info', JSON.stringify({ id: 3, username: 'operator', name: '操作员', role: '操作员', status: '正常' }));
    });
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.locator('.el-radio-button:has-text("列表管理")').click();
    await page.waitForTimeout(1500);
    // 选中第一行以触发批量操作栏
    await page.locator('.el-table__body .el-checkbox').first().click().catch(() => {});
    await page.waitForTimeout(500);
    const opBatchDeleteBtn = page.locator('.batch-bar button:has-text("批量删除")');
    const opHasBatchDelete = await opBatchDeleteBtn.isVisible().catch(() => false);
    console.log(`  [DOM断言] 操作员批量删除按钮存在: ${opHasBatchDelete} (期望 true)`);
    if (!opHasBatchDelete) {
      results.push({ name: `_dom-assert-operator-${vp.label}.txt`, ok: false, reason: '操作员未看到批量删除按钮' });
    }
  } finally {
    await ctx.close();
    await browser.close();
  }
  return results;
}

async function run() {
  const all = [];
  for (const vp of viewports) {
    console.log(`\n===== 视口 ${vp.width}×${vp.height} =====`);
    try {
      all.push(...(await runViewport(vp)));
    } catch (err) {
      console.log(`  视口 ${vp.label} 整体失败: ${err.message}`);
    }
  }

  console.log('\n=== 服务型资产正式页面截图汇总 ===');
  let okCount = 0;
  for (const r of all) {
    const exists = fs.existsSync(path.join(SHOT_DIR, r.name));
    const status = r.ok && exists ? 'OK  ' : 'FAIL';
    if (r.ok && exists) okCount++;
    console.log(`  ${status} ${r.name}`);
  }
  console.log(`\n共 ${all.length} 张，成功 ${okCount} 张，输出目录：${SHOT_DIR}`);
  if (okCount < all.length) process.exit(1);
}

run().catch((err) => {
  console.error('截图脚本失败:', err);
  process.exit(1);
});
