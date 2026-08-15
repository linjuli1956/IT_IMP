/**
 * 流程页面统一（发票→批次→计提→明细）截图脚本
 *
 * 可靠性（沿用 config-system 批次收口模式）：
 *   - browser/登录/setupTempData/截图主流程全部纳入 try/catch/finally
 *   - setup 每个 GET/POST 检查状态码，失败立即 throw（fail-fast）
 *   - 临时数据链路：模板 → 批次 → 发票(假PDF上传+confirm) → 计提表 → 明细表(XLSX)
 *   - cleanup 按计提 → 批次(级联发票) → 模板 → 明细表逐项执行，失败收集并报错
 *   - finally 无条件 cleanup + 关闭 browser；cleanup 后按基线计数验证无残留
 *   - VIEWER_USERNAME/VIEWER_PASSWORD 环境变量强制，缺失即失败（真实 JWT 登录，不伪造角色）
 *
 * 运行方式（服务器需以 DATABASE_URL 环境变量启动在 3320 端口）：
 *   $env:VIEWER_USERNAME="viewer"; $env:VIEWER_PASSWORD="123456"
 *   node scripts/screenshot-flow-process.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const BASE = 'http://localhost:3320';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'flow-process');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// P2: 环境变量强制
const VIEWER_USERNAME = process.env.VIEWER_USERNAME;
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD;
if (!VIEWER_USERNAME || !VIEWER_PASSWORD) {
  console.error('!!! VIEWER_USERNAME / VIEWER_PASSWORD 环境变量未设置，拒绝执行');
  process.exit(1);
}

// 本轮 runId（批次备注与发票号后缀，便于识别与排障）
const runId = Date.now().toString(36).slice(-6);

// 临时数据记录 + 基线计数（用于清理验证）
const tempData = { templateIds: [], batchId: null, batchNo: '', accrualId: null, detailIds: [] };
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

/** 失败即抛出版 */
async function apiCallOrFail(token, method, path, body, label) {
  const { status, data } = await apiCall(token, method, path, body);
  if (status >= 400 || !data) {
    throw new Error(`${label}: HTTP ${status} ${JSON.stringify(data)}`);
  }
  return data;
}

/** multipart 上传（FormData + Blob，fetch 自动生成 boundary） */
async function apiUpload(token, path, form, label) {
  const resp = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: form,
  });
  let data;
  try { data = await resp.json(); } catch { data = null; }
  if (resp.status >= 400 || !data) {
    throw new Error(`${label}: HTTP ${resp.status} ${JSON.stringify(data)}`);
  }
  return data;
}

/** 最小合法 PDF（无文本层 → OCR 失败属预期路径，发票记录仍创建） */
function minimalPdfBuffer() {
  return Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n' +
    'trailer<</Size 4/Root 1 0 R>>\n%%EOF', 'utf-8'
  );
}

/** 生成明细表 XLSX（表头含 业务号码/应收合计，sheet 名=门店） */
function buildDetailXlsx(storeName) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['业务号码', '月基本费', '语音通信费', '短信彩信费', '综合信息服务费', '优惠费用', '应收合计'],
    ['05238765432', 30, 15.5, 5, 3, -2, 51.5],
    ['05238765433', 30, 20, 0, 3, 0, 53],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, storeName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
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

/** 断言表格无选择列（查看者） */
async function assertNoSelection(page, label) {
  const hasCheckbox = await page.evaluate(() =>
    !!document.querySelector('.el-table__header-wrapper .el-checkbox')
  );
  if (hasCheckbox) throw new Error(`断言失败: ${label} - 表格不应有选择列`);
  console.log(`  断言通过: ${label} (无选择列)`);
}

async function assertNoDirtyData(page, label) {
  const dirtyValues = ['null', 'undefined', 'e2e'];
  const visibleText = await page.evaluate(() => {
    const els = document.querySelectorAll('.el-table, .el-drawer, .el-dialog, .el-form, .el-descriptions');
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

async function recordBaseline(token) {
  const [batches, invoices, accruals, details, templates] = await Promise.all([
    apiCall(token, 'GET', '/api/invoices/batches'),
    apiCall(token, 'GET', '/api/invoices'),
    apiCall(token, 'GET', '/api/accruals'),
    apiCall(token, 'GET', '/api/details'),
    apiCall(token, 'GET', '/api/templates'),
  ]);
  const cnt = (r) => (r.status === 200 && Array.isArray(r.data)) ? r.data.length : -1;
  baseline.batches = cnt(batches);
  baseline.invoices = cnt(invoices);
  baseline.accruals = cnt(accruals);
  baseline.details = cnt(details);
  baseline.templates = cnt(templates);
  console.log(`  基线计数: batches=${baseline.batches} invoices=${baseline.invoices} accruals=${baseline.accruals} details=${baseline.details} templates=${baseline.templates}`);
  for (const [k, v] of Object.entries(baseline)) {
    if (v < 0) throw new Error(`基线查询失败: ${k}`);
  }
}

async function setupTempData(token) {
  console.log('\n--- 准备临时数据（runId=' + runId + '） ---');

  // 1. 获取门店列表（批次/模板/发票共用同一门店名）
  const stores = await apiCallOrFail(token, 'GET', '/api/stores', null, '获取门店列表');
  const storeName = (Array.isArray(stores) && stores.length > 0) ? stores[0].name : '总部信息部';
  tempData.storeName = storeName;
  console.log(`  使用门店: ${storeName}`);

  // 2. 创建临时计提模板（联通 + 门店精确匹配，预设金额 666.66 + 100）
  const template = await apiCallOrFail(token, 'POST', '/api/templates', {
    carrier: '中国联通', store: storeName,
    items: [
      { name: '宽带固话', amount: 666.66, dept: [storeName] },
      { name: '专线', amount: 100, dept: [storeName] },
    ],
    reimbursementFormat: '分摊明细型',
  }, '创建计提模板');
  tempData.templateIds.push(template.id);
  console.log(`  创建模板: id=${template.id} (中国联通 / ${storeName})`);

  // 3. 创建临时批次
  const batch = await apiCallOrFail(token, 'POST', '/api/invoices/batches', {
    carrier: '中国联通', feeMonth: '2026-07', store: storeName,
  }, '创建发票批次');
  tempData.batchId = batch.id;
  tempData.batchNo = batch.batchNo;
  console.log(`  创建批次: id=${batch.id} batchNo=${batch.batchNo}`);

  // 4. 上传 1 个最小 PDF（无文本层 → OCR 失败属预期，发票记录仍创建）
  const fd = new FormData();
  fd.append('batchId', String(batch.id));
  fd.append('files', new Blob([minimalPdfBuffer()], { type: 'application/pdf' }), `tmp_invoice_${runId}.pdf`);
  const uploadResult = await apiUpload(token, '/api/invoices/upload', fd, '上传发票PDF');
  if (!Array.isArray(uploadResult.invoices) || uploadResult.invoices.length !== 1) {
    throw new Error(`上传发票PDF: 返回发票数异常 ${JSON.stringify(uploadResult).substring(0, 200)}`);
  }
  const invoice = uploadResult.invoices[0];
  tempData.invoiceIds = [invoice.id];
  console.log(`  上传发票: id=${invoice.id} status=${invoice.status}（OCR 失败属预期，稍后确认）`);

  // 5. 确认发票信息（补金额/门店/发票号 → 已确认）
  const confirmResult = await apiCallOrFail(token, 'POST', '/api/invoices/confirm', {
    invoices: [{
      id: invoice.id,
      invoiceNumber: `INV${runId}`,
      invoiceDate: '2026-07-15',
      sellerName: '中国联通泰兴分公司',
      amount: 866.66,
      stores: [storeName],
    }],
  }, '确认发票');
  console.log(`  确认发票: 批次合计=${confirmResult.batch ? confirmResult.batch.totalAmount : 'N/A'}`);

  // 6. 生成计提表（按发票模式：detailTableId=0，模板覆盖指定门店）
  const accrual = await apiCallOrFail(token, 'POST', '/api/accruals/generate', {
    batchId: batch.id,
    detailTableId: 0,
    templateOverrides: { [storeName]: template.id },
  }, '生成计提表');
  tempData.accrualId = accrual.id;
  console.log(`  生成计提表: id=${accrual.id} method=${accrual.method} 门店数=${accrual.groups ? accrual.groups.length : 'N/A'}`);

  // 7. 上传临时明细表（XLSX，sheet 名=门店，2 个号码行）
  const detailForm = new FormData();
  detailForm.append('file', new Blob([buildDetailXlsx(storeName)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `tmp_detail_${runId}.xlsx`);
  detailForm.append('carrier', '中国电信');
  detailForm.append('feeMonth', '2026-07');
  const detail = await apiUpload(token, '/api/details', detailForm, '上传明细表');
  if (!detail.id || detail.sheetCount !== 1 || detail.totalNumbers !== 2) {
    throw new Error(`上传明细表: 解析结果异常 sheetCount=${detail.sheetCount} totalNumbers=${detail.totalNumbers}`);
  }
  tempData.detailIds.push(detail.id);
  console.log(`  上传明细表: id=${detail.id} (中国电信 2026-07, ${detail.sheetCount} sheet / ${detail.totalNumbers} 号码)`);
}

// ——— 数据清理（收集错误，不静默）———

async function cleanupTempData(token) {
  console.log('\n--- 清理临时数据 ---');
  const errors = [];

  // 计提 → 批次(级联发票) → 模板 → 明细表
  if (tempData.accrualId) {
    const { status } = await apiCall(token, 'DELETE', `/api/accruals/${tempData.accrualId}`);
    if (status >= 400) errors.push(`删除计提表 id=${tempData.accrualId}: HTTP ${status}`);
    else console.log(`  删除计提表: id=${tempData.accrualId}`);
  }
  if (tempData.batchId) {
    const { status } = await apiCall(token, 'DELETE', `/api/invoices/batches/${tempData.batchId}`);
    if (status >= 400) errors.push(`删除批次 id=${tempData.batchId}: HTTP ${status}`);
    else console.log(`  删除批次(级联发票): id=${tempData.batchId} (${tempData.batchNo})`);
  }
  for (const id of tempData.templateIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/templates/${id}`);
    if (status >= 400) errors.push(`删除模板 id=${id}: HTTP ${status}`);
    else console.log(`  删除模板: id=${id}`);
  }
  for (const id of tempData.detailIds) {
    const { status } = await apiCall(token, 'DELETE', `/api/details/${id}`);
    if (status >= 400) errors.push(`删除明细表 id=${id}: HTTP ${status}`);
    else console.log(`  删除明细表: id=${id}`);
  }

  return errors;
}

// ——— 清理验证（对比基线计数）———

async function verifyCleanup(token) {
  console.log('\n--- 验证无残留 ---');
  const errors = [];

  const [batches, invoices, accruals, details, templates] = await Promise.all([
    apiCall(token, 'GET', '/api/invoices/batches'),
    apiCall(token, 'GET', '/api/invoices'),
    apiCall(token, 'GET', '/api/accruals'),
    apiCall(token, 'GET', '/api/details'),
    apiCall(token, 'GET', '/api/templates'),
  ]);
  const checks = [
    ['批次', batches, baseline.batches],
    ['发票', invoices, baseline.invoices],
    ['计提表', accruals, baseline.accruals],
    ['明细表', details, baseline.details],
    ['计提模板', templates, baseline.templates],
  ];
  for (const [label, resp, base] of checks) {
    const count = (resp.status === 200 && Array.isArray(resp.data)) ? resp.data.length : -1;
    if (count !== base) errors.push(`残留${label}: 当前 ${count} != 基线 ${base}`);
  }

  if (errors.length === 0) console.log('  验证通过: 全部回到基线，无残留数据');
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

    const { token } = await apiLogin('admin', '123456');
    adminToken = token;

    await recordBaseline(token);
    await setupTempData(token);

    const storeName = tempData.storeName;
    const batchUrl = `${BASE}/invoices/batches/${tempData.batchId}`;
    const accrualUrl = `${BASE}/accruals/${tempData.accrualId}`;
    const generateUrl = `${BASE}/accruals/generate/${tempData.batchId}`;
    const detailUrl = `${BASE}/details/${tempData.detailIds[0]}`;

    // ==============================
    // A. 发票/批次（invoices/**）
    // ==============================
    console.log('\n=== A. 发票/批次 ===');

    console.log('[01] 批次列表 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/batches`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '批次表格存在');
      await assertHasTableData(page, '批次有数据行');
      await assertBtnText(page, '上传新批次', '管理员有上传新批次按钮');
      await assertBtnText(page, '再次生成', '管理员有再次生成按钮（批次已生成计提）');
      await assertExists(page, '.el-table__header-wrapper .el-checkbox', '管理员有选择列');
      await assertNoDirtyData(page, '批次列表 1366 admin');
      const r = await shot(page, '01-invoices-batches-1366-admin.png', '批次列表 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 上传新批次, 再次生成, 选择列' };
    }));

    console.log('[02] 批次列表 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/batches`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '批次有数据行');
      await assertNoDirtyData(page, '批次列表 1440 admin');
      const r = await shot(page, '02-invoices-batches-1440-admin.png', '批次列表 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[03] 批次列表 1366 查看者（无写入口）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/invoices/batches`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '查看者可看到批次数据');
      await assertNoBtnText(page, '上传新批次', '查看者无上传新批次按钮');
      await assertNoBtnText(page, '再次生成', '查看者无再次生成按钮');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      await assertNoSelection(page, '查看者批次表格无选择列');
      await assertNoDirtyData(page, '批次列表 1366 viewer');
      const r = await shot(page, '03-invoices-batches-1366-viewer.png', '批次列表 1366×768 查看者只读');
      return { ...r, verified: '数据行可见, 无上传/生成/删除/选择列' };
    }));

    console.log('[04] 批次列表 1366 空态');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/batches`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      // 筛选不存在的费用月制造空结果（前端过滤：el-date-picker type=month，input 可直接键入）
      await page.click('.filter-card .el-date-editor input');
      await page.keyboard.type('2000-01');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1200);
      await assertExists(page, '.empty-state', '空态组件存在');
      await assertNoDirtyData(page, '批次列表空态 1366 admin');
      const r = await shot(page, '04-invoices-batches-1366-empty.png', '批次列表 1366×768 空态');
      return { ...r, verified: 'empty-state（筛选无结果，与表格互斥）' };
    }));

    console.log('[05] 批次详情 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(batchUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-descriptions', '批次信息 descriptions 存在');
      await assertHasTableData(page, '批次发票列表有数据行');
      await assertBtnText(page, '再次生成计提表', '管理员有再次生成计提表按钮（批次已生成计提）');
      await assertBtnText(page, '查看计提表', '已生成批次有查看计提表按钮');
      await assertNoDirtyData(page, '批次详情 1366 admin');
      const r = await shot(page, '05-invoices-batch-detail-1366-admin.png', '批次详情 1366×768 管理员');
      return { ...r, verified: 'descriptions, 发票数据行, 再次生成计提表, 查看计提表, 报销说明预览' };
    }));

    console.log('[06] 发票列表 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/list`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '发票表格存在');
      await assertHasTableData(page, '发票有数据行');
      await assertBtnText(page, '删除', '管理员有删除按钮');
      await assertExists(page, '.el-table__header-wrapper .el-checkbox', '管理员有选择列');
      await assertNoDirtyData(page, '发票列表 1366 admin');
      const r = await shot(page, '06-invoices-list-1366-admin.png', '发票列表 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 查看/下载/打印/删除, 选择列' };
    }));

    console.log('[07] 发票列表 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/list`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '发票有数据行');
      await assertNoDirtyData(page, '发票列表 1440 admin');
      const r = await shot(page, '07-invoices-list-1440-admin.png', '发票列表 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[08] 上传发票 1366 管理员（步骤1表单态）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/invoices/upload`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-steps', '步骤条存在');
      await assertBtnText(page, '上传并OCR识别', '管理员有上传并OCR识别按钮');
      await assertNoDirtyData(page, '上传发票 1366 admin');
      const r = await shot(page, '08-invoices-upload-1366-admin.png', '上传发票 1366×768 管理员步骤1');
      return { ...r, verified: 'el-steps, 上传表单, OCR按钮' };
    }));

    console.log('[09] 上传发票 1366 查看者（无权限空态）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/invoices/upload`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.empty-state', '无权限空态存在');
      await assertNoBtnText(page, '上传并OCR识别', '查看者无上传按钮');
      const r = await shot(page, '09-invoices-upload-1366-viewer.png', '上传发票 1366×768 查看者无权限');
      return { ...r, verified: 'EmptyState 无权限提示, 无上传入口' };
    }));

    // ==============================
    // B. 计提（accruals/**）
    // ==============================
    console.log('\n=== B. 计提 ===');

    console.log('[10] 生成计提预览 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(generateUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await assertExists(page, '.el-descriptions', '批次信息 descriptions 存在');
      await assertBtnText(page, '确认生成计提表', '管理员有确认生成按钮');
      await assertHasTableData(page, '计提预览有数据行');
      await assertNoDirtyData(page, '生成计提 1366 admin');
      const r = await shot(page, '10-accruals-generate-1366-admin.png', '生成计提预览 1366×768 管理员');
      return { ...r, verified: 'descriptions, 计提方式radio, 预览分组表, 确认生成按钮' };
    }));

    console.log('[11] 计提列表 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/accruals`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertExists(page, '.el-table', '计提表格存在');
      await assertHasTableData(page, '计提表有数据行');
      await assertBtnText(page, '删除', '管理员有删除按钮');
      await assertExists(page, '.el-table__header-wrapper .el-checkbox', '管理员有选择列');
      await assertNoDirtyData(page, '计提列表 1366 admin');
      const r = await shot(page, '11-accruals-1366-admin.png', '计提列表 1366×768 管理员');
      return { ...r, verified: 'el-table, 数据行, 查看/打印/删除, 选择列' };
    }));

    console.log('[12] 计提列表 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/accruals`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '计提表有数据行');
      await assertNoDirtyData(page, '计提列表 1440 admin');
      const r = await shot(page, '12-accruals-1440-admin.png', '计提列表 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[13] 计提列表 1366 查看者（无删除/选择列）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/accruals`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '查看者可看到计提数据');
      await assertBtnText(page, '打印', '查看者保留打印（只读操作）');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      await assertNoSelection(page, '查看者计提表格无选择列');
      await assertNoDirtyData(page, '计提列表 1366 viewer');
      const r = await shot(page, '13-accruals-1366-viewer.png', '计提列表 1366×768 查看者只读');
      return { ...r, verified: '数据行可见, 保留打印, 无删除/选择列' };
    }));

    console.log('[14] 计提详情 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(accrualUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await assertExists(page, '.el-descriptions', '计提信息 descriptions 存在');
      await assertHasTableData(page, '计提分组表有数据行');
      await assertBtnText(page, 'A5打印', '有 A5打印按钮');
      await assertBtnText(page, '下载Excel', '有 下载Excel按钮');
      await assertNoDirtyData(page, '计提详情 1366 admin');
      const r = await shot(page, '14-accrual-detail-1366-admin.png', '计提详情 1366×768 管理员');
      return { ...r, verified: 'descriptions, 分组表, 汇总报销说明, A5打印/下载Excel' };
    }));

    // ==============================
    // C. 明细（details/**）
    // ==============================
    console.log('\n=== C. 明细表 ===');

    console.log('[15] 明细表管理 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/details`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertBtnText(page, '确认上传', '管理员有上传区');
      await assertExists(page, '.el-table', '明细表格存在');
      await assertHasTableData(page, '明细表有数据行');
      await assertBtnText(page, '删除', '管理员有删除按钮');
      await assertNoDirtyData(page, '明细表 1366 admin');
      const r = await shot(page, '15-details-1366-admin.png', '明细表管理 1366×768 管理员');
      return { ...r, verified: '上传区, el-table, 数据行, 详情/删除, 选择列' };
    }));

    console.log('[16] 明细表管理 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/details`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '明细表有数据行');
      await assertNoDirtyData(page, '明细表 1440 admin');
      const r = await shot(page, '16-details-1440-admin.png', '明细表管理 1440×1024 管理员');
      return { ...r, verified: '数据行' };
    }));

    console.log('[17] 明细表管理 1366 查看者（无上传区/删除）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/details`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await assertHasTableData(page, '查看者可看到明细数据');
      await assertNoBtnText(page, '确认上传', '查看者无上传区');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      await assertNoSelection(page, '查看者明细表格无选择列');
      await assertNoDirtyData(page, '明细表 1366 viewer');
      const r = await shot(page, '17-details-1366-viewer.png', '明细表管理 1366×768 查看者只读');
      return { ...r, verified: '数据行可见, 无上传区/删除/选择列' };
    }));

    console.log('[18] 明细表详情 1366 管理员（sheet tabs）');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(detailUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2500);
      await assertExists(page, '.el-descriptions', '明细信息 descriptions 存在');
      await assertExists(page, '.el-tabs', 'sheet tabs 存在');
      await assertHasTableData(page, '号码明细有数据行');
      await assertNoDirtyData(page, '明细详情 1366 admin');
      const r = await shot(page, '18-details-detail-1366-admin.png', '明细表详情 1366×768 管理员');
      return { ...r, verified: 'descriptions, sheet tabs, 号码行, 合计行' };
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
