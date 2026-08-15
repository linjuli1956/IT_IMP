/**
 * 统一视觉语言第二组：合同管理 + 支付管理 截图脚本
 *
 * 可靠性（沿用已冻结批次的收口模式）：
 *   - browser/登录/setupTempData/截图主流程全部纳入 try/catch/finally
 *   - setup 每个 GET/POST 检查状态码，失败立即 throw（fail-fast）
 *   - 临时数据：合同 3 条（有效/临期/已过期，演示状态色）+ 支付配置 3 条
 *     （普通/敏感脱敏/停用），runId 标识，业务化命名
 *   - cleanup 按支付 → 合同逐项执行，失败收集并报错；finally 无条件执行
 *   - cleanup 后按基线计数验证无残留
 *   - VIEWER_USERNAME/VIEWER_PASSWORD 环境变量强制，缺失即失败（真实 JWT，不伪造角色）
 *   - 敏感演示值为非真实凭据的占位串；断言明文敏感值不出现在页面 DOM（防泄露）
 *   - 支付截图经搜索栏筛选共同商标识（泰兴门店支付服务），最终截图仅含本轮
 *     业务化数据，库内存量历史记录不入镜；assertNoDirtyData 增加独立测试值
 *     （123/333/555/111/222）单元格级精确检查，不误判商户号等正常长数字
 *
 * 运行方式（服务器需以 DATABASE_URL 环境变量启动在 3320 端口）：
 *   $env:VIEWER_USERNAME="viewer"; $env:VIEWER_PASSWORD="123456"
 *   node scripts/screenshot-contracts-payment.cjs          # 全量 01-10
 *   $env:ONLY="payment"; node scripts/screenshot-contracts-payment.cjs   # 仅支付 06-10（P1 收口）
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3320';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'contracts-payment');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// 环境变量强制
const VIEWER_USERNAME = process.env.VIEWER_USERNAME;
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD;
if (!VIEWER_USERNAME || !VIEWER_PASSWORD) {
  console.error('!!! VIEWER_USERNAME / VIEWER_PASSWORD 环境变量未设置，拒绝执行');
  process.exit(1);
}

const runId = Date.now().toString(36).slice(-6);

// 运行模式：ONLY=payment 时跳过合同数据与 01-05 截图，仅重跑支付 06-10（P1 收口用）
const ONLY = (process.env.ONLY || 'all').trim().toLowerCase();

// 敏感演示值（非真实凭据的占位串，仅用于脱敏展示验证）
const DEMO_SECRET = 'A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6';

// 本轮临时数据共同商标识：业务化名称，供支付页搜索栏筛选；runId 仅用于后台，不出现在截图
const DEMO_PROVIDER = '泰兴门店支付服务';

const tempData = { contractIds: [], paymentIds: [] };
const baseline = {};

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

async function apiCallOrFail(token, method, path, body, label) {
  const { status, data } = await apiCall(token, method, path, body);
  if (status >= 400 || !data) {
    throw new Error(`${label}: HTTP ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

// ——— 页面工具 ———

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

async function assertHasTableData(page, label) {
  const rowCount = await page.evaluate(() => {
    return document.querySelectorAll('.el-table__body-wrapper .el-table__row').length;
  });
  if (rowCount === 0) throw new Error(`断言失败: ${label} - 表格无数据行`);
  console.log(`  断言通过: ${label} (${rowCount} 行数据)`);
}

/** 断言表格无选择列（查看者写入口隐藏） */
async function assertNoSelection(page, label) {
  const hasCheckbox = await page.evaluate(() =>
    !!document.querySelector('.el-table__header-wrapper .el-checkbox')
  );
  if (hasCheckbox) throw new Error(`断言失败: ${label} - 表格不应有选择列`);
  console.log(`  断言通过: ${label} (无选择列)`);
}

/** 断言敏感明文不出现在页面可见文本中（防泄露） */
async function assertNoSecretLeak(page, label) {
  const leaked = await page.evaluate((secret) => {
    return document.body.innerText.includes(secret);
  }, DEMO_SECRET);
  if (leaked) throw new Error(`防泄露断言失败: ${label} - 页面出现敏感明文`);
  console.log(`  防泄露断言通过: ${label}`);
}

async function assertNoDirtyData(page, label) {
  // 子串级脏值：可见文本不得包含（保留原有检查）
  const dirtySubstrings = ['null', 'undefined', 'e2e', 'tmp', '123456'];
  // 独立测试值：单元格级精确匹配（避免把商户号等正常长数字误判为 123/111 等）
  const dirtyCellValues = ['123', '333', '555', '111', '222'];
  const { visibleText, cellValues } = await page.evaluate(() => {
    const els = document.querySelectorAll('.el-table, .el-drawer, .el-dialog, .el-form, .el-descriptions');
    let text = '';
    els.forEach(el => { if (el.offsetHeight > 0) text += (el.innerText || '') + ' '; });
    const cellEls = document.querySelectorAll(
      '.el-table .el-table__row .cell, .el-dialog .el-form-item__content, .el-descriptions__body .cell'
    );
    const cellValues = [];
    cellEls.forEach(c => {
      if (c.offsetParent !== null) {
        (c.innerText || '').split('\n').forEach(line => {
          const v = line.trim();
          if (v) cellValues.push(v);
        });
      }
    });
    return { visibleText: text, cellValues };
  });
  for (const dirty of dirtySubstrings) {
    if (visibleText.toLowerCase().includes(dirty)) {
      throw new Error(`数据质量断言失败: ${label} - 可见区域包含脏值 "${dirty}"`);
    }
  }
  for (const value of cellValues) {
    if (dirtyCellValues.includes(value)) {
      throw new Error(`数据质量断言失败: ${label} - 单元格出现独立测试值 "${value}"`);
    }
  }
  console.log(`  数据质量断言通过: ${label}`);
}

/** 通过搜索栏筛选共同商标识，仅展示本轮 3 条业务化临时数据（排除库内存量记录） */
async function filterToDemoData(page, label) {
  await page.fill('input[placeholder^="搜索机构代码"]', DEMO_PROVIDER);
  await page.waitForTimeout(600);
  const rows = await page.evaluate(() => {
    const wrapper = document.querySelector('.el-table__body-wrapper');
    return wrapper ? wrapper.querySelectorAll('.el-table__row').length : -1;
  });
  if (rows !== 3) {
    throw new Error(`筛选断言失败: ${label} - 期望仅本轮 3 行业务化数据，实际 ${rows} 行`);
  }
  console.log(`  筛选断言通过: ${label} - 仅展示本轮 3 行业务化配置`);
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

async function recordBaseline(token) {
  const [contracts, payments] = await Promise.all([
    apiCall(token, 'GET', '/api/contracts'),
    apiCall(token, 'GET', '/api/payments'),
  ]);
  const cnt = (r) => (r.status === 200 && Array.isArray(r.data)) ? r.data.length : -1;
  baseline.contracts = cnt(contracts);
  baseline.payments = cnt(payments);
  console.log(`  基线计数: contracts=${baseline.contracts} payments=${baseline.payments}`);
  for (const [k, v] of Object.entries(baseline)) {
    if (v < 0) throw new Error(`基线查询失败: ${k}`);
  }
}

/** 日期偏移工具：YYYY-MM-DD */
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function setupTempData(token) {
  console.log('\n--- 准备临时数据（runId=' + runId + '） ---');

  // 1. 获取门店（支付配置使用真实门店，与页面下拉一致）
  const stores = await apiCallOrFail(token, 'GET', '/api/stores', null, '获取门店列表');
  const store = (Array.isArray(stores) && stores.length > 0) ? stores[0] : null;
  if (!store || !store.code) throw new Error('获取门店失败：无可用门店（支付配置需机构代码）');
  console.log(`  使用门店: ${store.name} (code=${store.code})`);

  // 2. 合同 3 条：有效（绿）/ 临期（橙，+15 天）/ 已过期（红，-30 天）
  // ONLY=payment 模式下跳过合同临时数据（P1 收口仅重跑支付 06-10，合同 01-05 不重做）
  const contracts = ONLY === 'payment' ? [] : [
    {
      title: '门店宽带服务合同', supplierName: '中国电信泰兴分公司', type: '宽带',
      amount: 12800, signDate: dateOffset(-400), expireDate: dateOffset(300), remark: '门店宽带年度服务',
    },
    {
      title: '收银设备采购合同', supplierName: '华为技术有限公司', type: '设备采购',
      amount: 86000, signDate: dateOffset(-350), expireDate: dateOffset(15), remark: '收银机与扫码设备',
    },
    {
      title: '监控系统维保合同', supplierName: '锐捷网络股份有限公司', type: '维保',
      amount: 15600, signDate: dateOffset(-400), expireDate: dateOffset(-30), remark: '监控网络维保',
    },
  ];
  for (const c of contracts) {
    const created = await apiCallOrFail(token, 'POST', '/api/contracts', c, `创建合同(${c.title})`);
    tempData.contractIds.push(created.id);
    console.log(`  创建合同: id=${created.id} ${c.title} (${c.type})`);
  }

  // 3. 支付配置 3 条：普通 / 敏感（脱敏展示）/ 停用
  // 服务商统一为业务化商标识 DEMO_PROVIDER：截图时经搜索栏筛选，仅展示本轮数据，
  // 库内存量历史记录（含遗留测试值）不入最终截图；runId 仅用于后台唯一性与清理
  const payments = [
    {
      storeId: store.code, storeName: store.name, payMethod: 'wx', payMethodName: '微信',
      provider: DEMO_PROVIDER, configName: '商户号', configValue: '8210663799251',
      posNo: '', status: '正常', isSensitive: false,
    },
    {
      storeId: store.code, storeName: store.name, payMethod: 'wx', payMethodName: '微信',
      provider: DEMO_PROVIDER, configName: '支付密钥', configValue: DEMO_SECRET,
      posNo: '', status: '正常', isSensitive: true,
    },
    {
      storeId: store.code, storeName: store.name, payMethod: 'zfb', payMethodName: '支付宝',
      provider: DEMO_PROVIDER, configName: '设备号', configValue: 'FACE-8823-0091',
      posNo: 'POS0091', status: '停用', isSensitive: false,
    },
  ];
  for (const p of payments) {
    const created = await apiCallOrFail(token, 'POST', '/api/payments', p, `创建支付配置(${p.configName})`);
    tempData.paymentIds.push(created.id);
    console.log(`  创建支付配置: id=${created.id} ${store.name}/${p.configName}(${p.isSensitive ? '敏感' : '普通'}/${p.status})`);
  }
}

// ——— 数据清理（收集错误，不静默）———

async function cleanupTempData(token) {
  console.log('\n--- 清理临时数据 ---');
  const errors = [];

  for (const id of tempData.paymentIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/payments/${id}`);
    if (status >= 400) errors.push(`删除支付配置 id=${id}: HTTP ${status}`);
    else console.log(`  删除支付配置: id=${id}`);
  }
  for (const id of tempData.contractIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/contracts/${id}`);
    if (status >= 400) errors.push(`删除合同 id=${id}: HTTP ${status}`);
    else console.log(`  删除合同: id=${id}`);
  }
  return errors;
}

async function verifyCleanup(token) {
  console.log('\n--- 验证无残留 ---');
  const errors = [];
  const [contracts, payments] = await Promise.all([
    apiCall(token, 'GET', '/api/contracts'),
    apiCall(token, 'GET', '/api/payments'),
  ]);
  if (contracts.status === 200 && Array.isArray(contracts.data)) {
    const found = contracts.data.filter(c => tempData.contractIds.includes(c.id));
    if (found.length) errors.push(`残留合同: ${found.length} 条`);
  }
  if (payments.status === 200 && Array.isArray(payments.data)) {
    const found = payments.data.filter(p => tempData.paymentIds.includes(p.id));
    if (found.length) errors.push(`残留支付配置: ${found.length} 条`);
  }
  if (!errors.length) console.log('  验证通过: 全部回到基线，无残留数据');
  return errors;
}

// ——— 主流程 ———

async function run() {
  const results = [];
  let browser = null;
  let adminToken = null;
  let runError = null;
  let cleanupErrors = [];
  let verifyErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const { token } = await apiLogin('admin', '123456');
    adminToken = token;

    await recordBaseline(token);
    await setupTempData(token);

    // ==============================
    // A. 合同管理（ONLY=payment 时整体跳过）
    // ==============================
    if (ONLY !== 'payment') {
    console.log('\n=== A. 合同管理 ===');

    console.log('[01] 合同列表 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '合同表格存在');
      await assertHasTableData(page, '合同有数据行');
      await assertBtnText(page, '新增合同', '管理员有新增合同按钮');
      await assertBtnText(page, '编辑', '管理员有编辑按钮');
      await assertBtnText(page, '删除', '管理员有删除按钮');
      await assertExists(page, '.el-table__header-wrapper .el-checkbox', '管理员有选择列');
      await assertNoDirtyData(page, '合同列表 1366 admin');
      const r = await shot(page, '01-contracts-1366-admin.png', '合同列表 1366×768 管理员');
      return { ...r, verified: 'el-table, 3行数据(有效/临期/过期), 新增/编辑/删除, 选择列, 中性类型标签' };
    }));

    console.log('[02] 合同列表 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '合同有数据行');
      await assertNoDirtyData(page, '合同列表 1440 admin');
      const r = await shot(page, '02-contracts-1440-admin.png', '合同列表 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[03] 合同列表 1366 筛选空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      // 搜索不存在关键词制造空结果（前端过滤，与表格互斥；用 placeholder 定位避开 el-select 的 readonly input）
      await page.fill('input[placeholder="搜索标题/客户"]', '不存在的合同关键词');
      await page.waitForTimeout(800);
      await assertExists(page, '.empty-state', '空态组件存在');
      const r = await shot(page, '03-contracts-1366-empty.png', '合同列表 1366×768 筛选空态');
      return { ...r, verified: 'empty-state（筛选无结果，与表格互斥）' };
    }));

    console.log('[04] 合同编辑弹窗 1366 管理员（含附件上传区）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      // 点击首行"编辑"打开 Dialog
      const editBtn = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.el-table button'));
        const b = btns.find(x => x.textContent.includes('编辑'));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!editBtn) throw new Error('断言失败: 行内编辑按钮不可用');
      await page.waitForTimeout(800);
      await assertExists(page, '.el-dialog', '编辑弹窗存在');
      await assertExists(page, '.el-form', '弹窗表单存在');
      const hasUpload = await page.evaluate(() => !!document.body.innerText.includes('将合同PDF拖拽到此处'));
      if (!hasUpload) throw new Error('断言失败: 弹窗内 PDF 拖拽上传区不存在');
      await assertBtnText(page, '保存', '弹窗有保存按钮');
      await assertNoDirtyData(page, '合同编辑弹窗 1366 admin');
      const r = await shot(page, '04-contracts-edit-dialog-1366-admin.png', '合同编辑弹窗 1366×768 管理员');
      return { ...r, verified: 'el-dialog, 表单校验, PDF拖拽上传区, 保存' };
    }));

    console.log('[05] 合同列表 1366 查看者（无写入口）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/contracts`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '查看者可看到合同数据');
      await assertNoBtnText(page, '新增合同', '查看者无新增合同按钮');
      await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      await assertNoSelection(page, '查看者合同表格无选择列');
      await assertNoDirtyData(page, '合同列表 1366 viewer');
      const r = await shot(page, '05-contracts-1366-viewer.png', '合同列表 1366×768 查看者只读');
      return { ...r, verified: '数据行可见, 附件链接保留, 无新增/编辑/删除/选择列' };
    }));

    } // end if (ONLY !== 'payment')

    // ==============================
    // B. 支付管理
    // ==============================
    console.log('\n=== B. 支付管理 ===');

    console.log('[06] 支付配置 1366 管理员（脱敏默认态）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '支付配置表格存在');
      await filterToDemoData(page, '支付列表 1366 admin');
      await assertHasTableData(page, '支付配置有数据行');
      await assertExists(page, '.stat-row', '统计卡存在');
      await assertBtnText(page, '新增配置', '管理员有新增配置按钮');
      await assertBtnText(page, '编辑', '管理员有编辑按钮');
      await assertNoSecretLeak(page, '支付列表默认脱敏');
      await assertNoDirtyData(page, '支付配置 1366 admin');
      const r = await shot(page, '06-payment-1366-admin.png', '支付配置 1366×768 管理员');
      return { ...r, verified: '统计卡, 筛选后仅本轮3行业务化配置(普通/敏感/停用), 敏感值脱敏, 状态色, 新增/编辑' };
    }));

    console.log('[07] 支付配置 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await filterToDemoData(page, '支付列表 1440 admin');
      await assertHasTableData(page, '支付配置有数据行');
      await assertNoSecretLeak(page, '支付列表 1440 默认脱敏');
      await assertNoDirtyData(page, '支付配置 1440 admin');
      const r = await shot(page, '07-payment-1440-admin.png', '支付配置 1440×1024 管理员');
      return { ...r, verified: '数据行(筛选后仅本轮3行业务化配置)' };
    }));

    console.log('[08] 支付新增配置弹窗 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await filterToDemoData(page, '支付新增弹窗背景 1366 admin');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const b = btns.find(x => x.textContent.includes('新增配置'));
        if (b) b.click();
      });
      await page.waitForTimeout(800);
      await assertExists(page, '.el-dialog', '新增配置弹窗存在');
      const hasForm = await page.evaluate(() => !!document.body.innerText.includes('配置项名称'));
      if (!hasForm) throw new Error('断言失败: 弹窗内配置项表单不存在');
      await assertBtnText(page, '保存', '弹窗有保存按钮');
      await assertNoDirtyData(page, '支付新增弹窗 1366 admin');
      const r = await shot(page, '08-payment-edit-dialog-1366-admin.png', '支付新增配置弹窗 1366×768 管理员');
      return { ...r, verified: 'el-dialog, 门店/支付方式/服务商表单, 敏感开关, 状态radio' };
    }));

    console.log('[09] 支付配置 1366 敏感字段脱敏态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await filterToDemoData(page, '支付脱敏态 1366 admin');
      // 断言敏感行脱敏样式 + 眼睛图标存在
      const masked = await page.evaluate(() => !!document.querySelector('.value-text.masked'));
      if (!masked) throw new Error('断言失败: 敏感配置值未脱敏显示');
      const eyeIcon = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.value-cell'));
        return cells.some(c => !!c.querySelector('.toggle-icon'));
      });
      if (!eyeIcon) throw new Error('断言失败: 敏感配置行无眼睛切换图标');
      await assertNoSecretLeak(page, '脱敏态敏感明文不出现');
      await assertNoDirtyData(page, '支付脱敏态 1366 admin');
      const r = await shot(page, '09-payment-1366-masked.png', '支付配置 1366×768 敏感字段脱敏态');
      return { ...r, verified: 'masked 样式, 眼睛切换图标, 明文不出现在 DOM' };
    }));

    console.log('[10] 支付配置 1366 查看者（批量复制保留、无写入口）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/payment`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await filterToDemoData(page, '支付列表 1366 viewer');
      await assertHasTableData(page, '查看者可看到支付配置');
      await assertNoBtnText(page, '新增配置', '查看者无新增配置按钮');
      await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      await assertNoSecretLeak(page, '查看者默认脱敏');
      // 勾选首行 → 批量栏出现"批量复制"且无"批量删除"（读操作保留、写操作隐藏）
      await page.click('.el-table__body-wrapper .el-checkbox');
      await page.waitForTimeout(600);
      await assertBtnText(page, '批量复制', '查看者勾选后出现批量复制（读操作）');
      await assertNoBtnText(page, '批量删除', '查看者勾选后无批量删除');
      await assertNoDirtyData(page, '支付配置 1366 viewer');
      const r = await shot(page, '10-payment-1366-viewer.png', '支付配置 1366×768 查看者（批量复制保留）');
      return { ...r, verified: '数据行可见, 选择列保留, 批量复制可用, 无新增/编辑/删除/批量删除' };
    }));

  } catch (err) {
    runError = err;
  } finally {
    if (adminToken) {
      cleanupErrors = await cleanupTempData(adminToken);
      if (cleanupErrors.length > 0) {
        console.error('\n!!! 清理失败项:');
        for (const e of cleanupErrors) console.error(`  - ${e}`);
      }
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
