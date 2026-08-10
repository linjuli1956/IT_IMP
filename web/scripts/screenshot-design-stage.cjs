/**
 * 阶段0设计稿截图：design/ledger-workspace + design/service-workspace
 * 双视口：1366×768 与 1440×1024
 * 覆盖：各 tab 列表态 + 电子秤校准工作台 + 详情抽屉态（含敏感字段）
 * Playwright headless，含关键元素校验
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3124';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'design-stage');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

const viewports = [
  { width: 1366, height: 768, label: '1366' },
  { width: 1440, height: 1024, label: '1440' },
];

async function login(page) {
  // 设计稿为静态假数据，不请求 API；auth.global 仅前端检查 token 存在。
  // 注入 mock token + 管理员身份即可访问 /design/* 页面（无需数据库）。
  // 同时拦截布局全局 API（fetchStores/fetchSettings），避免 401 触发跳转 /login。
  await page.route(`${BASE}/api/stores`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
  );
  await page.route(`${BASE}/api/settings`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  await page.route(`${BASE}/api/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    localStorage.setItem('token', 'design-stage-mock-token');
    localStorage.setItem('user_info', JSON.stringify({ id: 1, username: 'admin', name: '管理员', role: '管理员', status: '正常' }));
  });
  console.log('  注入 mock token + API 路由拦截（设计稿静态页无需数据库）');
}

async function shot(page, name, label) {
  console.log(`  ${label}...`);
  await page.waitForTimeout(1500);
  // 关键元素检测（设计稿含 PageHeader + el-table/el-tabs/service-card）
  const hasKey = await page.evaluate(() => {
    return !!(
      document.querySelector('.page-header') ||
      document.querySelector('.el-table') ||
      document.querySelector('.el-tabs') ||
      document.querySelector('.service-card') ||
      document.querySelector('.calib-workbench')
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

async function clickTab(page, label) {
  await page.locator(`.el-tabs__item:has-text("${label}")`).click();
  await page.waitForTimeout(800);
}

/** 包装单个截图步骤：出错不中断后续步骤，partial results 保留 */
async function step(results, name, label, fn) {
  try {
    const r = await fn();
    results.push({ name, ...r });
  } catch (err) {
    console.log(`  !! ${label} 失败: ${err.message.slice(0, 120)}`);
    results.push({ name, ok: false, reason: err.message.slice(0, 120) });
  }
}

async function openDrawerForRow(page) {
  // 多 tab 各含表格，隐藏 pane 的行 offsetParent=null；filter visible 只取可见行
  const row = page.locator('.el-table__body tr').filter({ visible: true }).first();
  await row.waitFor({ state: 'visible', timeout: 5000 });
  await row.click();
  await page.waitForTimeout(1000);
}

async function closeDrawer(page) {
  await page.locator('.el-drawer__close-btn').click().catch(() => {});
  // 备用：按 Escape 关闭抽屉
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
}

async function runViewport(vp) {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const results = [];
  try {
    await login(page);

    // ===== 台账型 ledger-workspace =====
    await page.goto(`${BASE}/design/ledger-workspace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 网络设备 tab（默认）
    await step(results, `ledger-${vp.label}-device.png`, `[${vp.label}] 网络设备强化表格`,
      () => shot(page, `ledger-${vp.label}-device.png`, `[${vp.label}] 网络设备强化表格`));

    // 电脑 tab
    await clickTab(page, '电脑');
    await step(results, `ledger-${vp.label}-computer.png`, `[${vp.label}] 电脑强化表格（保修预警）`,
      () => shot(page, `ledger-${vp.label}-computer.png`, `[${vp.label}] 电脑强化表格（保修预警）`));

    // 固话 tab
    await clickTab(page, '固话');
    await step(results, `ledger-${vp.label}-phone.png`, `[${vp.label}] 固话强化表格`,
      () => shot(page, `ledger-${vp.label}-phone.png`, `[${vp.label}] 固话强化表格`));

    // 电子秤 tab（含校准工作台）
    await clickTab(page, '电子秤');
    await step(results, `ledger-${vp.label}-scale-workbench.png`, `[${vp.label}] 电子秤校准工作台+列表`,
      () => shot(page, `ledger-${vp.label}-scale-workbench.png`, `[${vp.label}] 电子秤校准工作台+列表`));

    // 电脑行→详情抽屉
    await clickTab(page, '电脑');
    await page.waitForTimeout(500);
    await openDrawerForRow(page);
    await step(results, `ledger-${vp.label}-drawer-computer.png`, `[${vp.label}] 电脑详情抽屉`,
      () => shot(page, `ledger-${vp.label}-drawer-computer.png`, `[${vp.label}] 电脑详情抽屉`));
    await closeDrawer(page);

    // ===== 服务型 service-workspace =====
    await page.goto(`${BASE}/design/service-workspace`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // 域名卡片网格（默认）
    await step(results, `service-${vp.label}-domain.png`, `[${vp.label}] 域名卡片网格`,
      () => shot(page, `service-${vp.label}-domain.png`, `[${vp.label}] 域名卡片网格`));

    // 小程序卡片网格
    await clickTab(page, '小程序');
    await step(results, `service-${vp.label}-miniapp.png`, `[${vp.label}] 小程序卡片网格`,
      () => shot(page, `service-${vp.label}-miniapp.png`, `[${vp.label}] 小程序卡片网格`));

    // 域名卡片→详情抽屉（含敏感字段）
    await clickTab(page, '域名');
    await page.waitForTimeout(500);
    await page.locator('.service-card').filter({ visible: true }).first().click();
    await page.waitForTimeout(1000);
    await step(results, `service-${vp.label}-drawer-domain.png`, `[${vp.label}] 域名详情抽屉（敏感字段）`,
      () => shot(page, `service-${vp.label}-drawer-domain.png`, `[${vp.label}] 域名详情抽屉（敏感字段）`));
    await closeDrawer(page);
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

  console.log('\n=== 阶段0设计稿截图汇总 ===');
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
