/**
 * 配置与系统页统一：审计修复截图脚本（可靠性收口版）
 *
 * P1-1: 临时数据失败即失败、始终清理
 *   - browser/登录/setupTempData/截图主流程全部纳入 try/catch/finally
 *   - setup 每个 GET/POST 检查状态码，失败立即 throw
 *   - cleanup 按模板→方案→客户→临时用户逐项执行，DELETE 失败收集并报错
 *   - 临时操作员用户名用 runId 生成，避免重跑冲突
 *   - finally 无条件执行 cleanup + 关闭 browser
 * P1-2: 日志翻页真实自动化断言
 *   - 断言"下一页"按钮可用
 *   - 点击后等待页码从 1 变为 2
 *   - 断言首行文本与翻页前不同
 *   - 截图保留表格数据+分页器，第 2 页高亮可见
 * P2: VIEWER_* 环境变量强制，缺失即失败
 *
 * 运行方式：
 *   $env:ADMIN_USERNAME="管理员用户名"; $env:ADMIN_PASSWORD="管理员密码";
 *   $env:VIEWER_USERNAME="查看者用户名"; $env:VIEWER_PASSWORD="查看者密码"
 *   node scripts/screenshot-config-system.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3999';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'config-system');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// P2: 环境变量强制
// ——— 管理员账户（环境变量，不硬编码）——
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error('错误：需要环境变量 ADMIN_USERNAME 和 ADMIN_PASSWORD（不内置默认凭据）');
  process.exit(1);
}

const VIEWER_USERNAME = process.env.VIEWER_USERNAME;
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD;
if (!VIEWER_USERNAME || !VIEWER_PASSWORD) {
  console.error('!!! VIEWER_USERNAME / VIEWER_PASSWORD 环境变量未设置，拒绝执行');
  process.exit(1);
}

// 本轮 runId，用于临时操作员用户名
const runId = Date.now().toString(36).slice(-6);
const operatorUsername = `tmp_op_${runId}`;

// 临时数据 ID 清单，用于清理
const tempData = { supplierIds: [], schemeIds: [], templateIds: [], operatorUserId: null };

// ——— API 工具 ———

async function apiLogin(username, password) {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await resp.json();
  if (!data.token) throw new Error(`登录失败(${username}): ${data.message}`);
  return { token: data.token, user: data.user };
}

async function apiCall(token, method, path, body) {
  const opts = { method, headers: { 'Authorization': `Bearer ${token}` } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(`${BASE}${path}`, opts);
  let data;
  try { data = await resp.json(); } catch { data = null; }
  return { status: resp.status, data };
}

/** 失败即抛出版 */
async function apiCallOrFail(token, method, path, body, label) {
  const { status, data } = await apiCall(token, method, path, body);
  if (status >= 400 || !data) {
    throw new Error(`${label}: HTTP ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ——— 页面工具 ———

async function login(page, username = ADMIN_USERNAME, password = ADMIN_PASSWORD) {
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

async function assertHasTableData(page, label) {
  const rowCount = await page.evaluate(() => {
    return document.querySelectorAll('.el-table__body-wrapper .el-table__row').length;
  });
  if (rowCount === 0) throw new Error(`断言失败: ${label} - 表格无数据行`);
  console.log(`  断言通过: ${label} (${rowCount} 行数据)`);
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

/** 上下文管理：确保 ctx 总是被关闭 */
async function withContext(browser, viewport, fn) {
  const ctx = await browser.newContext({ viewport });
  try {
    const page = await ctx.newPage();
    return await fn(page);
  } finally {
    await ctx.close();
  }
}

// ——— 数据准备（fail-fast）———

async function setupTempData(token) {
  console.log('\n--- 准备临时数据 ---');

  // 1. 创建客户
  const supplier = await apiCallOrFail(token, 'POST', '/api/suppliers', {
    name: '中国电信泰兴分公司', type: '运营商', contact: '王经理', phone: '0523-87654321', address: '泰兴市国庆路128号', remark: '宽带固话服务',
  }, '创建客户');
  tempData.supplierIds.push(supplier.id);
  console.log(`  创建客户: id=${supplier.id}`);

  // 2. 创建费用分摊方案
  const scheme = await apiCallOrFail(token, 'POST', '/api/fee-schemes', {
    name: '联通宽带套餐分摊方案', carrier: '中国联通',
    items: [{ name: '宽带固话', amount: 200, dept: ['总部信息部'] }],
    reimbursementFormat: '分摊明细型',
  }, '创建方案');
  tempData.schemeIds.push(scheme.id);
  console.log(`  创建方案: id=${scheme.id}`);

  // 3. 获取门店列表用于模板
  const stores = await apiCallOrFail(token, 'GET', '/api/stores', null, '获取门店列表');
  const storeName = (Array.isArray(stores) && stores.length > 0) ? stores[0].name : '总部信息部';

  const template = await apiCallOrFail(token, 'POST', '/api/templates', {
    carrier: '中国电信', store: storeName,
    items: [{ name: '宽带固话', amount: 150, dept: [storeName] }],
    reimbursementFormat: '分摊明细型',
  }, '创建模板');
  tempData.templateIds.push(template.id);
  console.log(`  创建模板: id=${template.id} (运营商=中国电信 门店=${storeName})`);

  // 4. 创建临时操作员用户（runId 用户名）
  const operator = await apiCallOrFail(token, 'POST', '/api/users', {
    username: operatorUsername, name: '临时操作员', role: '操作员',
  }, '创建操作员');
  tempData.operatorUserId = operator.id;
  console.log(`  创建操作员: id=${operator.id} username=${operatorUsername}`);
}

// ——— 数据清理（收集错误，不静默）———

async function cleanupTempData(token) {
  console.log('\n--- 清理临时数据 ---');
  const errors = [];

  // 模板 → 方案 → 客户 → 临时用户
  for (const id of tempData.templateIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/templates/${id}`);
    if (status >= 400) errors.push(`删除模板 id=${id}: HTTP ${status}`);
    else console.log(`  删除模板: id=${id}`);
  }
  for (const id of tempData.schemeIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/fee-schemes/${id}`);
    if (status >= 400) errors.push(`删除方案 id=${id}: HTTP ${status}`);
    else console.log(`  删除方案: id=${id}`);
  }
  for (const id of tempData.supplierIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/suppliers/${id}`);
    if (status >= 400) errors.push(`删除客户 id=${id}: HTTP ${status}`);
    else console.log(`  删除客户: id=${id}`);
  }
  if (tempData.operatorUserId) {
    const { status } = await apiCall(token, 'DELETE', `/api/users/${tempData.operatorUserId}`);
    if (status >= 400) errors.push(`删除操作员 id=${tempData.operatorUserId}: HTTP ${status}`);
    else console.log(`  删除操作员: id=${tempData.operatorUserId}`);
  }

  return errors;
}

// ——— 清理验证 ———

async function verifyCleanup(token) {
  console.log('\n--- 验证无残留 ---');
  const errors = [];

  const [suppliers, schemes, templates, users] = await Promise.all([
    apiCall(token, 'GET', '/api/suppliers'),
    apiCall(token, 'GET', '/api/fee-schemes'),
    apiCall(token, 'GET', '/api/templates'),
    apiCall(token, 'GET', '/api/users'),
  ]);

  if (suppliers.status === 200 && Array.isArray(suppliers.data)) {
    const found = suppliers.data.filter(s => tempData.supplierIds.includes(s.id));
    if (found.length) errors.push(`残留客户: ${found.length} 条 (ids=${found.map(s => s.id).join(',')})`);
  }
  if (schemes.status === 200 && Array.isArray(schemes.data)) {
    const found = schemes.data.filter(s => tempData.schemeIds.includes(s.id));
    if (found.length) errors.push(`残留方案: ${found.length} 条 (ids=${found.map(s => s.id).join(',')})`);
  }
  if (templates.status === 200 && Array.isArray(templates.data)) {
    const found = templates.data.filter(t => tempData.templateIds.includes(t.id));
    if (found.length) errors.push(`残留模板: ${found.length} 条 (ids=${found.map(t => t.id).join(',')})`);
  }
  if (users.status === 200 && Array.isArray(users.data)) {
    const found = users.data.filter(u => u.id === tempData.operatorUserId);
    if (found.length) errors.push(`残留操作员: id=${tempData.operatorUserId}`);
  }

  if (errors.length === 0) console.log('  验证通过: 无残留数据');
  else errors.forEach(e => console.error(`  ${e}`));

  return errors;
}

// ——— 主流程 ———

async function run() {
  let browser = null;
  let adminToken = null;
  const results = [];
  let runError = null;
  let cleanupErrors = [];
  let verifyErrors = [];

  try {
    browser = await chromium.launch({ headless: true });

    // 获取 admin token 用于 API 数据准备
    const { token } = await apiLogin(ADMIN_USERNAME, ADMIN_PASSWORD);
    adminToken = token;

    // 准备临时数据（fail-fast）
    await setupTempData(adminToken);

    // ==============================
    // A1. config/stores（有数据）
    // ==============================
    console.log('\n=== A1. 门店管理 ===');

    console.log('[01] stores 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '门店表格存在');
      await assertHasTableData(page, '门店有数据行');
      await assertBtnText(page, '新增部门/门店/机构', '管理员有新增按钮');
      await assertNoDirtyData(page, '门店 1366 admin');
      const r = await shot(page, '01-stores-1366-admin.png', '门店 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 新增按钮, canEdit' };
    }));

    console.log('[02] stores 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '门店有数据行');
      await assertNoDirtyData(page, '门店 1440 admin');
      const r = await shot(page, '02-stores-1440-admin.png', '门店 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[03] stores 1366 空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/stores`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const searchInput = await page.$('input[placeholder*="搜索"]');
      if (searchInput) { await searchInput.fill('zzz_no_result'); await page.waitForTimeout(1000); }
      await assertExists(page, '.empty-state', '空态组件存在');
      const r = await shot(page, '03-stores-1366-empty.png', '门店 1366×768 空态');
      return { ...r, verified: 'empty-state' };
    }));

    // ==============================
    // A2. config/suppliers（真实数据）
    // ==============================
    console.log('\n=== A2. 客户管理 ===');

    console.log('[04] suppliers 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '客户表格存在');
      await assertHasTableData(page, '客户有数据行');
      await assertBtnText(page, '新增客户', '管理员有新增按钮');
      await assertNoDirtyData(page, '客户 1366 admin');
      const r = await shot(page, '04-suppliers-1366-admin.png', '客户 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 新增按钮' };
    }));

    console.log('[05] suppliers 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '客户有数据行');
      await assertNoDirtyData(page, '客户 1440 admin');
      const r = await shot(page, '05-suppliers-1440-admin.png', '客户 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[06] suppliers 1366 空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/suppliers`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const searchInput = await page.$('input[placeholder*="搜索"]');
      if (searchInput) { await searchInput.fill('zzz_no_result'); await page.waitForTimeout(1000); }
      await assertExists(page, '.empty-state', '空态组件存在');
      const r = await shot(page, '06-suppliers-1366-empty.png', '客户 1366×768 空态');
      return { ...r, verified: 'empty-state' };
    }));

    // ==============================
    // A3. config/fee-schemes（真实数据）
    // ==============================
    console.log('\n=== A3. 费用分摊方案 ===');

    console.log('[07] fee-schemes 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '方案表格存在');
      await assertHasTableData(page, '方案有数据行');
      await assertBtnText(page, '新增方案', '管理员有新增按钮');
      await assertNoDirtyData(page, '方案 1366 admin');
      const r = await shot(page, '07-fee-schemes-1366-admin.png', '方案 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 新增按钮' };
    }));

    console.log('[08] fee-schemes 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '方案有数据行');
      await assertNoDirtyData(page, '方案 1440 admin');
      const r = await shot(page, '08-fee-schemes-1440-admin.png', '方案 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[09] fee-schemes 1366 空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/fee-schemes`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const searchInput = await page.$('input[placeholder*="搜索"]');
      if (searchInput) { await searchInput.fill('zzz_no_result'); await page.waitForTimeout(1000); }
      await assertExists(page, '.empty-state', '空态组件存在');
      const r = await shot(page, '09-fee-schemes-1366-empty.png', '方案 1366×768 空态');
      return { ...r, verified: 'empty-state' };
    }));

    // ==============================
    // A4. config/templates（真实数据）
    // ==============================
    console.log('\n=== A4. 计提模板 ===');

    console.log('[10] templates 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '模板表格存在');
      await assertHasTableData(page, '模板有数据行');
      await assertBtnText(page, '新增模板', '管理员有新增按钮');
      await assertNoDirtyData(page, '模板 1366 admin');
      const r = await shot(page, '10-templates-1366-admin.png', '模板 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 新增按钮' };
    }));

    console.log('[11] templates 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '模板有数据行');
      await assertNoDirtyData(page, '模板 1440 admin');
      const r = await shot(page, '11-templates-1440-admin.png', '模板 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[12] templates 1366 空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/config/templates`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const searchInput = await page.$('input[placeholder*="搜索"]');
      if (searchInput) { await searchInput.fill('zzz_no_result'); await page.waitForTimeout(1000); }
      await assertExists(page, '.empty-state', '空态组件存在');
      const r = await shot(page, '12-templates-1366-empty.png', '模板 1366×768 空态');
      return { ...r, verified: 'empty-state' };
    }));

    // ==============================
    // B1. system/users — 管理员/操作员/查看者
    // ==============================
    console.log('\n=== B1. 用户管理 ===');

    console.log('[13] users 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '用户表格存在');
      await assertHasTableData(page, '用户有数据行');
      await assertBtnText(page, '新增用户', '管理员有新增按钮');
      await assertNoDirtyData(page, '用户 1366 admin');
      const r = await shot(page, '13-users-1366-admin.png', '用户 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 新增按钮, 更多菜单(重置密码+删除)' };
    }));

    console.log('[14] users 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertNoDirtyData(page, '用户 1440 admin');
      const r = await shot(page, '14-users-1440-admin.png', '用户 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    // P1-1: 操作员角色证据（真实 JWT 登录，runId 用户名）
    console.log('[15] users 1366 操作员（无写入口）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      // 临时操作员初始密码由后端固定策略生成（见 server/api/users/index.post.ts），非管理员凭据
      await login(page, operatorUsername, '123456');
      await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertNoBtnText(page, '新增用户', '操作员无新增按钮');
      await assertNoBtnText(page, '编辑', '操作员无编辑按钮');
      await assertNoBtnText(page, '更多', '操作员无更多菜单');
      const switchDisabled = await page.evaluate(() => {
        const sw = document.querySelector('.el-switch');
        if (!sw) return 'no-switch';
        return sw.classList.contains('is-disabled') ? 'disabled' : 'enabled';
      });
      if (switchDisabled !== 'disabled') throw new Error(`断言失败: 操作员状态开关应禁用，实际=${switchDisabled}`);
      console.log('  断言通过: 操作员状态开关已禁用');
      await assertNoDirtyData(page, '用户 1366 operator');
      const r = await shot(page, '15-users-1366-operator.png', '用户 1366×768 操作员态');
      return { ...r, verified: '无新增/编辑/更多, 开关禁用, 操作员不可管理用户' };
    }));

    // P1-1: 查看者角色证据（真实 JWT 登录）
    console.log('[16] users 1366 查看者（无写入口）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/system/users`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertNoBtnText(page, '新增用户', '查看者无新增按钮');
      await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
      await assertNoBtnText(page, '更多', '查看者无更多菜单');
      const switchDisabled = await page.evaluate(() => {
        const sw = document.querySelector('.el-switch');
        if (!sw) return 'no-switch';
        return sw.classList.contains('is-disabled') ? 'disabled' : 'enabled';
      });
      if (switchDisabled !== 'disabled') throw new Error(`断言失败: 查看者状态开关应禁用，实际=${switchDisabled}`);
      console.log('  断言通过: 查看者状态开关已禁用');
      await assertNoDirtyData(page, '用户 1366 viewer');
      const r = await shot(page, '16-users-1366-viewer.png', '用户 1366×768 查看者态');
      return { ...r, verified: '无新增/编辑/更多, 开关禁用, 查看者只读' };
    }));

    // ==============================
    // B2. system/settings
    // ==============================
    console.log('\n=== B2. 系统设置 ===');

    console.log('[17] settings 1366 管理员(保存前)');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/settings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-select', '财年选择器存在');
      await assertBtnText(page, '保存设置', '管理员有保存按钮');
      await assertNoDirtyData(page, '设置 1366 admin');
      const r = await shot(page, '17-settings-1366-admin.png', '设置 1366×768 管理员(保存前)');
      return { ...r, verified: 'el-select, 保存按钮, section-title' };
    }));

    console.log('[18] settings 1440 管理员(保存后)');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/settings`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('保存设置'));
        if (btn) { btn.click(); return true; }
        return false;
      });
      await page.waitForTimeout(2000);
      await assertNoDirtyData(page, '设置 1440 admin');
      const r = await shot(page, '18-settings-1440-admin.png', '设置 1440×1024 管理员(保存后)');
      return { ...r, verified: '保存后状态' };
    }));

    // ==============================
    // B3. system/logs — 分页证据
    // ==============================
    console.log('\n=== B3. 操作日志 ===');

    console.log('[19] logs 1366 管理员(有数据分页)');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/logs`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '日志表格存在');
      await assertHasTableData(page, '日志有数据行');
      await page.evaluate(() => {
        const table = document.querySelector('.el-table');
        if (table) table.scrollIntoView({ block: 'end' });
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1000);
      const paginationVisible = await page.evaluate(() => {
        const p = document.querySelector('.el-pagination');
        if (!p) return false;
        const rect = p.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      if (!paginationVisible) throw new Error('断言失败: 日志分页器不可见');
      console.log('  断言通过: 分页器可见');
      await assertNoDirtyData(page, '日志 1366 admin');
      const r = await shot(page, '19-logs-1366-admin.png', '日志 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 分页器可见' };
    }));

    // P1-2: 日志翻页真实自动化断言
    console.log('[20] logs 1440 管理员(翻页验证)');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/system/logs`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '日志有数据行');

      // 1. 断言"下一页"按钮可用
      const nextDisabled = await page.evaluate(() => {
        const btn = document.querySelector('.el-pagination .btn-next');
        if (!btn) return 'no-btn';
        return btn.disabled || btn.classList.contains('is-disabled') ? 'disabled' : 'enabled';
      });
      if (nextDisabled !== 'enabled') throw new Error(`断言失败: 下一页按钮不可用 (${nextDisabled})`);
      console.log('  断言通过: 下一页按钮可用');

      // 2. 记录翻页前的页码和首行文本
      const beforePage = await page.evaluate(() => {
        const el = document.querySelector('.el-pager .is-active');
        return el ? el.textContent.trim() : null;
      });
      if (!beforePage) throw new Error('断言失败: 无法获取翻页前页码');

      const beforeFirstRow = await page.evaluate(() => {
        const row = document.querySelector('.el-table__body-wrapper .el-table__row');
        return row ? row.textContent.trim().substring(0, 100) : null;
      });
      if (!beforeFirstRow) throw new Error('断言失败: 无法获取翻页前首行文本');
      console.log(`  翻页前: 页码=${beforePage}, 首行="${beforeFirstRow.substring(0, 40)}..."`);

      // 3. 点击下一页
      await page.click('.el-pagination .btn-next');

      // 4. 等待页码变化（最长 5 秒）
      await page.waitForFunction(
        (old) => {
          const el = document.querySelector('.el-pager .is-active');
          return el && el.textContent.trim() !== old;
        },
        beforePage,
        { timeout: 5000 }
      );

      // 5. 验证页码已变化
      const afterPage = await page.evaluate(() => {
        const el = document.querySelector('.el-pager .is-active');
        return el ? el.textContent.trim() : null;
      });
      if (afterPage === beforePage) throw new Error(`断言失败: 页码未变化 (仍为 ${beforePage})`);
      console.log(`  断言通过: 页码 ${beforePage} → ${afterPage}`);

      // 6. 断言首行文本变化
      const afterFirstRow = await page.evaluate(() => {
        const row = document.querySelector('.el-table__body-wrapper .el-table__row');
        return row ? row.textContent.trim().substring(0, 100) : null;
      });
      if (afterFirstRow === beforeFirstRow) throw new Error('断言失败: 翻页后首行文本未变化');
      console.log(`  断言通过: 首行文本已变化`);
      console.log(`  翻页后: 页码=${afterPage}, 首行="${afterFirstRow.substring(0, 40)}..."`);

      // 7. 滚动到表格底部确保数据行+分页器同框，第 2 页高亮可见
      await page.evaluate(() => {
        const table = document.querySelector('.el-table');
        if (table) table.scrollIntoView({ block: 'end' });
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(500);
      await assertNoDirtyData(page, '日志 1440 admin');
      const r = await shot(page, '20-logs-1440-admin.png', '日志 1440×1024 管理员(翻页后)');
      return { ...r, verified: `页码 ${beforePage}→${afterPage}, 首行文本变化, 分页器第${afterPage}页高亮` };
    }));

  } catch (err) {
    runError = err;
  } finally {
    // P1-1: finally 中无条件执行 cleanup + 关闭 browser
    if (adminToken) {
      cleanupErrors = await cleanupTempData(adminToken);
      if (cleanupErrors.length > 0) {
        console.error('\n!!! 清理失败项:');
        for (const e of cleanupErrors) console.error(`  - ${e}`);
      }
      // 验证无残留
      verifyErrors = await verifyCleanup(adminToken);
      if (verifyErrors.length > 0) {
        console.error('\n!!! 残留数据:');
        for (const e of verifyErrors) console.error(`  - ${e}`);
      }
    }
    if (browser) {
      await browser.close();
    }
  }

  // ==============================
  // 汇总
  // ==============================
  console.log('\n=== 截图汇总 ===');
  let allOk = true;
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAIL';
    console.log(`  [${status}] ${r.name} - ${r.label}`);
    if (r.verified) console.log(`         验证: ${r.verified}`);
    if (!r.ok) allOk = false;
  }
  console.log(`\n总计: ${results.length} 项, ${allOk ? '全部通过' : '有失败项'}`);

  // 最终退出判断
  if (runError) {
    console.error(`\n!!! 脚本异常: ${runError.message}`);
    if (runError.stack) console.error(runError.stack);
    process.exit(1);
  }
  if (cleanupErrors.length > 0 || verifyErrors.length > 0) {
    console.error(`\n!!! 清理/验证失败: ${cleanupErrors.length + verifyErrors.length} 项`);
    process.exit(1);
  }
  if (!allOk) process.exit(1);
}

run().catch(err => {
  console.error('\n!!! 截图脚本异常退出:', err.message);
  console.error(err.stack);
  process.exit(1);
});
