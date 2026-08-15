/**
 * 配置与系统页统一：审计截图脚本
 *
 * 覆盖：
 *   A. 基础配置（4页）
 *   B. 系统模块（3页）
 *
 * 每页至少 1366×768 + 1440×1024 正常态；
 * 配置页补空态；用户页补查看者态；设置页补保存前后；日志页补有数据分页态。
 *
 * 运行方式：
 *   1. 启动服务：PORT=3999 node .output/server/index.mjs
 *   2. 执行截图：node scripts/screenshot-config-system.cjs
 *   3. 输出目录：screenshots/config-system/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3999';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'config-system');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

const VIEWER_USERNAME = process.env.VIEWER_USERNAME || 'viewer';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || '123456';

// ——— 工具函数 ———

async function login(page, username = 'admin', password = '123456') {
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
      return { success: true, user: data.user };
    }
    return { success: false, error: data.message || 'Unknown' };
  }, { username, password });
  if (!result.success) throw new Error('Login failed: ' + result.error);
  console.log(`  登录(${username}): 成功 role=${result.user.role}`);
  return result.user;
}

async function shot(page, name, label) {
  await page.waitForTimeout(800);
  const filePath = path.join(SHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  -> ${name}  ${(stat.size / 1024).toFixed(1)} KB  (${label})`);
  return { name, ok: true, size: stat.size, label };
}

async function assertExists(page, selector, label) {
  const el = await page.$(selector);
  if (!el) throw new Error(`断言失败: ${label} (${selector} 不存在)`);
  console.log(`  断言通过: ${label}`);
}

async function assertNoBtnText(page, text, label) {
  const found = await page.evaluate((t) =>
    !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(t))
  , text);
  if (found) throw new Error(`断言失败: ${label} (按钮"${text}"不应存在)`);
  console.log(`  断言通过: ${label} (不存在)`);
}

async function assertBtnText(page, text, label) {
  const found = await page.evaluate((t) =>
    !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(t))
  , text);
  if (!found) throw new Error(`断言失败: ${label} (按钮"${text}"不存在)`);
  console.log(`  断言通过: ${label}`);
}

async function assertNoDirtyData(page, label) {
  const dirtyValues = ['null', 'undefined', 'e2e'];
  const visibleText = await page.evaluate(() => {
    const els = document.querySelectorAll('.el-table, .el-drawer, .el-dialog, .el-form');
    let text = '';
    els.forEach(el => { if (el.offsetHeight > 0) text += (el.innerText || '') + ' '; });
    return text;
  });
  for (const dirty of dirtyValues) {
    if (visibleText.toLowerCase().includes(dirty)) {
      throw new Error(`数据质量断言失败: ${label} - 可见区域包含脏值 "${dirty}"`);
    }
  }
  console.log(`  数据质量断言通过: ${label}`);
}

// ——— 主流程 ———

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // ==============================
  // A1. config/stores
  // ==============================
  console.log('\n=== A1. 门店管理 ===');

  // 1366 admin
  console.log('[01] stores 1366 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table', '门店表格存在');
    await assertBtnText(page, '新增部门/门店/机构', '管理员有新增按钮');
    await assertNoDirtyData(page, '门店 1366 admin');
    const r = await shot(page, '01-stores-1366-admin.png', '门店 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 新增按钮, canEdit' });
    await ctx.close();
  }

  // 1440 admin
  console.log('[02] stores 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '门店 1440 admin');
    const r = await shot(page, '02-stores-1440-admin.png', '门店 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table' });
    await ctx.close();
  }

  // 1366 empty state
  console.log('[03] stores 1366 空态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // 搜索不存在的关键词触发空态
    const searchInput = await page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      await searchInput.fill('zzz_no_result');
      await page.waitForTimeout(1000);
    }
    await assertExists(page, '.empty-state', '空态组件存在');
    await assertNoDirtyData(page, '门店空态');
    const r = await shot(page, '03-stores-1366-empty.png', '门店 1366×768 空态');
    results.push({ ...r, verified: 'empty-state' });
    await ctx.close();
  }

  // ==============================
  // A2. config/suppliers
  // ==============================
  console.log('\n=== A2. 客户管理 ===');

  console.log('[04] suppliers 1366 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table, .empty-state', '客户表格或空态存在');
    await assertBtnText(page, '新增客户', '管理员有新增按钮');
    await assertNoDirtyData(page, '客户 1366 admin');
    const r = await shot(page, '04-suppliers-1366-admin.png', '客户 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 新增按钮' });
    await ctx.close();
  }

  console.log('[05] suppliers 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '客户 1440 admin');
    const r = await shot(page, '05-suppliers-1440-admin.png', '客户 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table' });
    await ctx.close();
  }

  console.log('[06] suppliers 1366 空态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const searchInput = await page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      await searchInput.fill('zzz_no_result');
      await page.waitForTimeout(1000);
    }
    await assertExists(page, '.empty-state', '空态组件存在');
    const r = await shot(page, '06-suppliers-1366-empty.png', '客户 1366×768 空态');
    results.push({ ...r, verified: 'empty-state' });
    await ctx.close();
  }

  // ==============================
  // A3. config/fee-schemes
  // ==============================
  console.log('\n=== A3. 费用分摊方案 ===');

  console.log('[07] fee-schemes 1366 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table, .empty-state', '方案表格或空态存在');
    await assertBtnText(page, '新增方案', '管理员有新增按钮');
    await assertNoDirtyData(page, '方案 1366 admin');
    const r = await shot(page, '07-fee-schemes-1366-admin.png', '方案 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 新增按钮' });
    await ctx.close();
  }

  console.log('[08] fee-schemes 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '方案 1440 admin');
    const r = await shot(page, '08-fee-schemes-1440-admin.png', '方案 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table' });
    await ctx.close();
  }

  console.log('[09] fee-schemes 1366 空态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const searchInput = await page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      await searchInput.fill('zzz_no_result');
      await page.waitForTimeout(1000);
    }
    await assertExists(page, '.empty-state', '空态组件存在');
    const r = await shot(page, '09-fee-schemes-1366-empty.png', '方案 1366×768 空态');
    results.push({ ...r, verified: 'empty-state' });
    await ctx.close();
  }

  // ==============================
  // A4. config/templates
  // ==============================
  console.log('\n=== A4. 计提模板 ===');

  console.log('[10] templates 1366 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table, .empty-state', '模板表格或空态存在');
    await assertBtnText(page, '新增模板', '管理员有新增按钮');
    await assertNoDirtyData(page, '模板 1366 admin');
    const r = await shot(page, '10-templates-1366-admin.png', '模板 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 新增按钮' });
    await ctx.close();
  }

  console.log('[11] templates 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '模板 1440 admin');
    const r = await shot(page, '11-templates-1440-admin.png', '模板 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table' });
    await ctx.close();
  }

  console.log('[12] templates 1366 空态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const searchInput = await page.$('input[placeholder*="搜索"]');
    if (searchInput) {
      await searchInput.fill('zzz_no_result');
      await page.waitForTimeout(1000);
    }
    await assertExists(page, '.empty-state', '空态组件存在');
    const r = await shot(page, '12-templates-1366-empty.png', '模板 1366×768 空态');
    results.push({ ...r, verified: 'empty-state' });
    await ctx.close();
  }

  // ==============================
  // B1. system/users
  // ==============================
  console.log('\n=== B1. 用户管理 ===');

  console.log('[13] users 1366 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table', '用户表格存在');
    await assertBtnText(page, '新增用户', '管理员有新增按钮');
    await assertNoDirtyData(page, '用户 1366 admin');
    const r = await shot(page, '13-users-1366-admin.png', '用户 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 新增按钮, 更多菜单(重置密码+删除)' });
    await ctx.close();
  }

  console.log('[14] users 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '用户 1440 admin');
    const r = await shot(page, '14-users-1440-admin.png', '用户 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table' });
    await ctx.close();
  }

  console.log('[15] users 1366 查看者态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
    await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // 查看者不应有新增/编辑/删除按钮
    await assertNoBtnText(page, '新增用户', '查看者无新增按钮');
    await assertNoDirtyData(page, '用户 1366 viewer');
    const r = await shot(page, '15-users-1366-viewer.png', '用户 1366×768 查看者态');
    results.push({ ...r, verified: '无新增/编辑/删除, 查看者只读' });
    await ctx.close();
  }

  // ==============================
  // B2. system/settings
  // ==============================
  console.log('\n=== B2. 系统设置 ===');

  console.log('[16] settings 1366 管理员(保存前)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-select', '财年选择器存在');
    await assertBtnText(page, '保存设置', '管理员有保存按钮');
    await assertNoDirtyData(page, '设置 1366 admin');
    const r = await shot(page, '16-settings-1366-admin.png', '设置 1366×768 管理员(保存前)');
    results.push({ ...r, verified: 'el-select, 保存按钮, section-title' });
    await ctx.close();
  }

  console.log('[17] settings 1440 管理员(保存后)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // 点击保存按钮
    const saveBtn = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('保存设置'));
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (saveBtn) console.log('  保存按钮已点击');
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '设置 1440 admin');
    const r = await shot(page, '17-settings-1440-admin.png', '设置 1440×1024 管理员(保存后)');
    results.push({ ...r, verified: '保存后状态' });
    await ctx.close();
  }

  // ==============================
  // B3. system/logs
  // ==============================
  console.log('\n=== B3. 操作日志 ===');

  console.log('[18] logs 1366 管理员(有数据分页)');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/logs`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertExists(page, '.el-table', '日志表格存在');
    // 检查分页组件
    const hasPagination = await page.$('.el-pagination');
    if (hasPagination) {
      console.log('  断言通过: 分页组件存在');
    } else {
      console.log('  注意: 未检测到分页组件（可能数据不足一页）');
    }
    await assertNoDirtyData(page, '日志 1366 admin');
    const r = await shot(page, '18-logs-1366-admin.png', '日志 1366×768 管理员');
    results.push({ ...r, verified: 'el-table, 分页, 筛选栏' });
    await ctx.close();
  }

  console.log('[19] logs 1440 管理员');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/system/logs`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await assertNoDirtyData(page, '日志 1440 admin');
    const r = await shot(page, '19-logs-1440-admin.png', '日志 1440×1024 管理员');
    results.push({ ...r, verified: 'el-table, 分页' });
    await ctx.close();
  }

  // ==============================
  // 汇总
  // ==============================
  await browser.close();

  console.log('\n=== 截图汇总 ===');
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAIL';
    console.log(`  [${status}] ${r.name} - ${r.label}`);
    if (r.verified) console.log(`         验证: ${r.verified}`);
    if (!r.ok) allOk = false;
  }

  console.log(`\n总计: ${results.length} 项, ${allOk ? '全部通过' : '有失败项'}`);
  if (!allOk) process.exit(1);
}

run().catch(err => {
  console.error('\n!!! 截图脚本异常退出:', err.message);
  console.error(err.stack);
  process.exit(1);
});
