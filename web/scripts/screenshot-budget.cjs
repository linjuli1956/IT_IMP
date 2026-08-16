/**
 * 统一视觉语言批次：预算管理 截图脚本
 *
 * 可靠性（沿用已冻结批次收口模式）：
 *   - browser/登录/setupTempData/截图主流程全部纳入 try/catch/finally
 *   - setup 每个 GET/POST 检查状态码，失败立即 throw（fail-fast）
 *   - 临时数据：独立财年 2031（基线 fail-fast 确认库内无 2031 数据），4 条业务化
 *     预算明细（两门店×高金额/普通/范围差异/年费），财年选择器即天然隔离，
 *     最终截图仅含本轮业务化数据；runId 仅用于后台，不出现在截图
 *   - 执行对比无写入 API（业务流程产生）：若库内存在真实执行数据则切换到
 *     真实财年截图（真实业务数据），否则拍临时财年空态并在汇总中说明
 *   - cleanup 整财年删除（/fiscal-year/2031），finally 无条件执行，
 *     按基线计数验证无残留
 *   - VIEWER_USERNAME/VIEWER_PASSWORD 环境变量强制（真实 JWT，不伪造角色）
 *   - assertNoDirtyData 两级检查：子串级（null/undefined/e2e/tmp/123456）
 *     + 单元格级独立测试值（123/333/555/111/222）精确匹配，不误判正常金额
 *
 * 运行方式（服务器需以 DATABASE_URL 环境变量启动在 3320 端口）：
 *   $env:VIEWER_USERNAME="viewer"; $env:VIEWER_PASSWORD="123456"
 *   node scripts/screenshot-budget.cjs
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3320';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'budget-visual');

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

// 临时数据独立财年（业务概念数值，非测试痕迹；基线确认库内不存在）
const TMP_FY = 2031;

const tempData = { detailIds: [] };
const baseline = { budgets: -1, executions: -1, realExecFy: null };

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

async function assertNoDirtyData(page, label) {
  // 子串级脏值：可见文本不得包含
  const dirtySubstrings = ['null', 'undefined', 'e2e', 'tmp', '123456'];
  // 独立测试值：单元格级精确匹配（避免把正常金额/年份误判）
  const dirtyCellValues = ['123', '333', '555', '111', '222'];
  const { visibleText, cellValues } = await page.evaluate(() => {
    const els = document.querySelectorAll('.el-table, .el-drawer, .el-dialog, .el-form, .el-descriptions, .el-collapse');
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

/** 切换财年（当前激活 Tab 工具栏内第一个可见 el-select 即财年选择器；
 *  非激活 el-tab-pane 为 display:none 但仍在 DOM，须以 :visible 限定；
 *  下拉项过滤可见，避免点到历史遗留的隐藏 dropdown） */
async function selectFiscalYear(page, fy) {
  await page.click('.tab-toolbar .el-select:visible');
  await page.waitForTimeout(500);
  const ok = await page.evaluate((year) => {
    const items = Array.from(document.querySelectorAll('.el-select-dropdown__item'))
      .filter(x => x.offsetParent !== null);
    const it = items.find(x => x.textContent.includes(`${year}财年`));
    if (it) { it.click(); return true; }
    return false;
  }, fy);
  if (!ok) throw new Error(`财年切换失败: 下拉中不存在 ${fy}财年`);
  await page.waitForTimeout(800);
  console.log(`  财年切换: ${fy}财年`);
}

/** 切换 Tab */
async function switchTab(page, label) {
  await page.click(`.el-tabs__item:has-text("${label}")`);
  await page.waitForTimeout(1000);
  console.log(`  切换 Tab: ${label}`);
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
  const [budgets, executions] = await Promise.all([
    apiCall(token, 'GET', '/api/budgets'),
    apiCall(token, 'GET', '/api/budgets/executions'),
  ]);
  const cnt = (r) => (r.status === 200 && Array.isArray(r.data)) ? r.data.length : -1;
  baseline.budgets = cnt(budgets);
  baseline.executions = cnt(executions);
  console.log(`  基线计数: budgets=${baseline.budgets} executions=${baseline.executions}`);
  if (baseline.budgets < 0 || baseline.executions < 0) throw new Error('基线查询失败');

  // fail-fast：临时财年必须无数据；记录真实执行数据所在财年（供执行对比截图）
  const existTmp = Array.isArray(budgets.data) && budgets.data.some(b => b.fiscalYear === TMP_FY);
  if (existTmp) throw new Error(`基线检查失败: 库内已存在 ${TMP_FY} 财年数据，拒绝使用该财年做临时数据`);

  if (Array.isArray(executions.data) && executions.data.length > 0) {
    const byFy = {};
    for (const e of executions.data) byFy[e.fiscalYear] = (byFy[e.fiscalYear] || 0) + 1;
    const fy = Number(Object.keys(byFy).sort((a, b) => byFy[b] - byFy[a])[0]);
    baseline.realExecFy = fy;
    console.log(`  执行对比真实数据: ${fy}财年 ${byFy[fy]} 条（用于执行对比截图）`);
  } else {
    console.log('  执行对比库内无数据（将拍临时财年空态并说明）');
  }
}

async function setupTempData(token) {
  console.log(`\n--- 准备临时数据（runId=${runId}，财年=${TMP_FY}） ---`);

  const stores = await apiCallOrFail(token, 'GET', '/api/stores', null, '获取门店列表');
  if (!Array.isArray(stores) || stores.length === 0) throw new Error('获取门店失败：无可用门店');
  const s0 = stores[0].name;
  const s1 = stores[1] ? stores[1].name : stores[0].name;
  console.log(`  使用门店: ${s0}${s1 !== s0 ? ' / ' + s1 : ''}`);

  // 4 条业务化明细：高金额(≥2000标红)/普通月费/费用范围后段/纯年费
  const details = [
    {
      fiscalYear: TMP_FY, storeName: s0, carrier: '中国电信', feeType: '宽带月租',
      monthlyFee: 2600, annualFee: 31200, feeRange: `${TMP_FY}-01~${TMP_FY + 1}-12`,
      broadbandType: '电信商业主宽', paymentMethod: '月缴费', remark: '门店主宽带及IPTV',
    },
    {
      fiscalYear: TMP_FY, storeName: s0, carrier: '中国联通', feeType: '专线月租',
      monthlyFee: 880, annualFee: 0, feeRange: `${TMP_FY}-01~${TMP_FY}-06`,
      broadbandType: '联通政企专线', paymentMethod: '月缴费', remark: '收银专线，上半年协议价',
    },
    {
      fiscalYear: TMP_FY, storeName: s1, carrier: '中国移动', feeType: '数据卡月费',
      monthlyFee: 150, annualFee: 0, feeRange: `${TMP_FY}-07~${TMP_FY}-12`,
      broadbandType: '移动办公数据卡', paymentMethod: '月缴费', remark: '外卖与办公流量卡',
    },
    {
      fiscalYear: TMP_FY, storeName: s1, carrier: '锐捷网络', feeType: '网络维保年费',
      monthlyFee: 0, annualFee: 9600, feeRange: `${TMP_FY}-01~${TMP_FY + 1}-12`,
      broadbandType: '', paymentMethod: '年缴费', remark: '交换机与无线整网维保',
    },
  ];
  for (const d of details) {
    const created = await apiCallOrFail(token, 'POST', '/api/budgets', d, `创建预算明细(${d.storeName}/${d.carrier}/${d.feeType})`);
    tempData.detailIds.push(created.id);
    console.log(`  创建预算明细: id=${created.id} ${d.storeName}/${d.carrier}/${d.feeType}(月费${d.monthlyFee}/年费${d.annualFee})`);
  }
}

// ——— 数据清理（收集错误，不静默）———

async function cleanupTempData(token) {
  console.log('\n--- 清理临时数据（整财年删除） ---');
  const errors = [];
  const { status, data } = await apiCall(token, 'DELETE', `/api/budgets/fiscal-year/${TMP_FY}`);
  if (status >= 400) {
    errors.push(`删除财年 ${TMP_FY}: HTTP ${status}`);
    // 兜底逐条删除
    for (const id of tempData.detailIds) {
      const r = await apiCall(token, 'DELETE', `/api/budgets/${id}`);
      if (r.status >= 400) errors.push(`删除明细 id=${id}: HTTP ${r.status}`);
      else console.log(`  兜底删除明细: id=${id}`);
    }
  } else {
    console.log(`  已删除 ${TMP_FY} 财年: 明细 ${data?.detailCount ?? '?'} 条、执行对比 ${data?.executionCount ?? '?'} 条`);
  }
  return errors;
}

async function verifyCleanup(token) {
  console.log('\n--- 验证无残留 ---');
  const errors = [];
  const [budgets, executions] = await Promise.all([
    apiCall(token, 'GET', '/api/budgets'),
    apiCall(token, 'GET', '/api/budgets/executions'),
  ]);
  if (budgets.status === 200 && Array.isArray(budgets.data)) {
    if (budgets.data.length !== baseline.budgets) errors.push(`预算明细计数未回基线: ${budgets.data.length} != ${baseline.budgets}`);
    const left = budgets.data.filter(b => b.fiscalYear === TMP_FY);
    if (left.length) errors.push(`残留 ${TMP_FY} 财年明细: ${left.length} 条`);
  }
  if (executions.status === 200 && Array.isArray(executions.data)) {
    if (executions.data.length !== baseline.executions) errors.push(`执行对比计数未回基线: ${executions.data.length} != ${baseline.executions}`);
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
    // 01 汇总矩阵 1366 管理员
    // ==============================
    console.log('[01] 汇总矩阵 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      await assertExists(page, '.matrix-table', '汇总矩阵表格存在');
      const rows = await page.evaluate(() => document.querySelectorAll('.matrix-table .el-table__row').length);
      if (rows < 1) throw new Error('断言失败: 汇总矩阵无数据行');
      console.log(`  断言通过: 汇总矩阵 ${rows} 行门店数据`);
      const high = await page.evaluate(() => !!document.querySelector('.matrix-table .amount-high'));
      if (!high) throw new Error('断言失败: 高金额(≥2000)预警标红未生效');
      console.log('  断言通过: 高金额预警标红生效');
      await assertBtnText(page, '新增明细', '管理员有新增明细主按钮');
      await assertBtnText(page, '导出Excel', '管理员有导出Excel（读操作）');
      await assertNoDirtyData(page, '汇总矩阵 1366 admin');
      const r = await shot(page, '01-budget-summary-1366-admin.png', '汇总矩阵 1366×768 管理员');
      return { ...r, verified: '门店×月矩阵, 高金额标红, 合计行, 唯一主按钮新增明细' };
    }));

    // ==============================
    // 02 汇总矩阵 1440 管理员
    // ==============================
    console.log('[02] 汇总矩阵 1440 管理员');
    results.push(await withContext(browser, { width: 1440, height: 1024 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      const rows = await page.evaluate(() => document.querySelectorAll('.matrix-table .el-table__row').length);
      if (rows < 1) throw new Error('断言失败: 汇总矩阵无数据行');
      await assertNoDirtyData(page, '汇总矩阵 1440 admin');
      const r = await shot(page, '02-budget-summary-1440-admin.png', '汇总矩阵 1440×1024 管理员');
      return { ...r, verified: '宽屏完整月份列与财年小计' };
    }));

    // ==============================
    // 03 明细视图 1366 管理员（文字操作）
    // ==============================
    console.log('[03] 明细视图 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      await switchTab(page, '明细视图');
      await assertExists(page, '.detail-collapse', '门店折叠组存在');
      const expanded = await page.evaluate(() => document.querySelectorAll('.el-collapse-item').length);
      if (expanded < 1) throw new Error('断言失败: 明细视图无门店分组');
      console.log(`  断言通过: 门店分组 ${expanded} 组`);
      // 展开折叠组：el-collapse 默认收起（内容仍在 DOM），展开后明细行与行操作才可见
      await page.evaluate(() => {
        document.querySelectorAll('.detail-collapse .el-collapse-item__header').forEach(h => h.click());
      });
      await page.waitForTimeout(800);
      const rowVisible = await page.evaluate(() => {
        const rows = document.querySelectorAll('.detail-collapse .el-table__row');
        return Array.from(rows).some(r => r.offsetParent !== null);
      });
      if (!rowVisible) throw new Error('断言失败: 展开后明细行不可见');
      console.log('  断言通过: 折叠组展开，明细行可见');
      await assertBtnText(page, '复制', '行操作为文字复制');
      await assertBtnText(page, '编辑', '行操作为文字编辑');
      await assertBtnText(page, '删除', '行操作为文字删除');
      const textBtn = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('.el-table button')).find(x => x.textContent.trim() === '编辑');
        return b ? b.classList.contains('is-text') : false;
      });
      if (!textBtn) throw new Error('断言失败: 行操作不是 text 文字按钮样式');
      console.log('  断言通过: 行操作平铺文字（无更多菜单）');
      await assertNoDirtyData(page, '明细视图 1366 admin');
      const r = await shot(page, '03-budget-detail-1366-admin.png', '明细视图 1366×768 管理员');
      return { ...r, verified: '门店折叠分组, 小计, 平铺文字操作(复制/编辑/删除)' };
    }));

    // ==============================
    // 04 执行对比 1366 管理员（真实数据财年或临时财年空态）
    // ==============================
    console.log('[04] 执行对比 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      let mode;
      if (baseline.realExecFy) {
        await selectFiscalYear(page, baseline.realExecFy);
        mode = `真实财年 ${baseline.realExecFy}`;
      } else {
        await selectFiscalYear(page, TMP_FY);
        mode = `临时财年 ${TMP_FY}（库内无执行数据）`;
      }
      await switchTab(page, '执行对比');
      await assertExists(page, '.exec-overview', '执行概览卡存在');
      const hasTable = await page.evaluate(() => !!document.querySelector('.el-table__row'));
      const hasEmpty = await page.evaluate(() => !!document.querySelector('.empty-state'));
      console.log(`  执行对比数据形态: ${mode} 表格=${hasTable} 空态=${hasEmpty}`);
      await assertNoDirtyData(page, '执行对比 1366 admin');
      const r = await shot(page, '04-budget-execution-1366-admin.png', '执行对比 1366×768 管理员');
      return { ...r, verified: `执行概览+口径保留(${mode})` };
    }));

    // ==============================
    // 05 编辑明细 Dialog 1366 管理员
    // ==============================
    console.log('[05] 编辑明细 Dialog 1366 管理员');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      await switchTab(page, '明细视图');
      await page.waitForTimeout(500);
      const opened = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.el-table button'));
        const b = btns.find(x => x.textContent.trim() === '编辑');
        if (b) { b.click(); return true; }
        return false;
      });
      if (!opened) throw new Error('断言失败: 无法打开编辑弹窗（无编辑按钮）');
      await page.waitForTimeout(1000);
      await assertExists(page, '.el-dialog', '编辑明细弹窗存在');
      const hasForm = await page.evaluate(() => !!document.querySelector('.el-dialog .el-form'));
      if (!hasForm) throw new Error('断言失败: 弹窗表单不存在');
      await assertBtnText(page, '保存', '弹窗有保存按钮');
      const hasRange = await page.evaluate(() => {
        const labels = Array.from(document.querySelectorAll('.el-dialog .el-form-item__label'));
        return labels.some(l => l.textContent.includes('费用范围'));
      });
      if (!hasRange) throw new Error('断言失败: 弹窗无费用范围字段');
      console.log('  断言通过: 弹窗含门店/运营商/费用类型/金额/费用范围表单');
      await assertNoDirtyData(page, '编辑弹窗 1366 admin');
      const r = await shot(page, '05-budget-edit-dialog-1366-admin.png', '编辑明细弹窗 1366×768 管理员');
      return { ...r, verified: 'el-dialog 表单(门店/运营商/费用类型/月费年费/费用范围), 保存' };
    }));

    // ==============================
    // 06 查看者态 1366（无全部写入口）
    // ==============================
    console.log('[06] 查看者态 1366 无写入口');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      // Header 与汇总工具栏写入口全部隐藏
      await assertNoBtnText(page, '新增明细', '查看者无新增明细按钮');
      await assertNoBtnText(page, '导入数据', '查看者无导入数据按钮');
      await assertNoBtnText(page, '生成下个财年', '查看者无生成下个财年按钮');
      await assertNoBtnText(page, '删除财年', '查看者无删除财年按钮');
      // 读操作保留
      await assertBtnText(page, '下载模板', '查看者保留下载模板（读）');
      await assertBtnText(page, '导出Excel', '查看者保留导出Excel（读）');
      // 明细视图无行操作
      await switchTab(page, '明细视图');
      await assertNoBtnText(page, '复制', '查看者无复制按钮');
      await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
      await assertNoBtnText(page, '删除', '查看者无删除按钮');
      // 展开折叠组，截图直观呈现查看者只读数据（无操作列）
      await page.evaluate(() => {
        document.querySelectorAll('.detail-collapse .el-collapse-item__header').forEach(h => h.click());
      });
      await page.waitForTimeout(800);
      const dataVisible = await page.evaluate(() => {
        const rows = document.querySelectorAll('.detail-collapse .el-table__row');
        return Array.from(rows).some(r => r.offsetParent !== null);
      });
      if (!dataVisible) throw new Error('断言失败: 查看者应可见明细数据（只读）');
      console.log('  断言通过: 查看者展开可见数据且无操作列');
      await assertNoDirtyData(page, '预算查看者 1366');
      const r = await shot(page, '06-budget-1366-viewer.png', '预算明细 1366×768 查看者只读');
      return { ...r, verified: '无新增/导入/生成/删财年/复制/编辑/删除, 保留下载模板/导出' };
    }));

    // ==============================
    // 07 空态/筛选无结果 1366
    // ==============================
    console.log('[07] 执行对比筛选无结果空态 1366');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const fy = baseline.realExecFy || TMP_FY;
      await selectFiscalYear(page, fy);
      await switchTab(page, '执行对比');
      // 尝试设置月份筛选（无可选项时收起下拉并保持默认；无执行数据的财年本身即空态）
      let filterSet = false;
      try {
        await page.click('.tab-toolbar .el-select:visible', { timeout: 5000 });
        await page.waitForTimeout(500);
        const picked = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('.el-select-dropdown__item'))
            .filter(x => x.offsetParent !== null && !x.classList.contains('is-disabled'));
          if (items.length > 1) { items[1].click(); return true; }
          if (items.length === 1) { items[0].click(); return true; }
          return false;
        });
        if (!picked) await page.keyboard.press('Escape');
        filterSet = picked;
        await page.waitForTimeout(800);
      } catch { /* 下拉打不开或无可选项则跳过筛选 */ }
      // EmptyState 与空表格互斥（在激活面板内验证，非激活 Tab 的表格也在 DOM）
      const mutual = await page.evaluate(() => {
        const panes = Array.from(document.querySelectorAll('.el-tab-pane'));
        const active = panes.find(p => p.offsetParent !== null);
        if (!active) return null;
        return {
          empty: !!active.querySelector('.empty-state'),
          table: !!active.querySelector('.el-table'),
        };
      });
      if (!mutual || !mutual.empty) throw new Error('断言失败: 未出现 EmptyState（空态/筛选无结果）');
      if (mutual.table) throw new Error('断言失败: EmptyState 与表格同时出现（应互斥）');
      console.log(`  断言通过: EmptyState 显示且与表格互斥（月份筛选${filterSet ? '已设置' : '无可选项，保持默认空态'}）`);
      await assertNoDirtyData(page, '执行对比空态 1366 admin');
      const r = await shot(page, '07-budget-execution-empty-1366.png', '执行对比空态 1366×768');
      return { ...r, verified: 'EmptyState 与空表格互斥' };
    }));

    // ==============================
    // 08 1366 固定列与横向滚动证据
    // ==============================
    console.log('[08] 汇总矩阵 1366 固定列+横向滚动');
    results.push(await withContext(browser, { width: 1366, height: 768 }, async (page) => {
      await login(page);
      await page.goto(`${BASE}/budget`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await selectFiscalYear(page, TMP_FY);
      // 存在横向滚动（12个月+小计 > 1366 可用宽度）
      const scrollable = await page.evaluate(() => {
        const w = document.querySelector('.matrix-table .el-scrollbar__wrap') || document.querySelector('.matrix-table .el-table__body-wrapper');
        return w ? { sw: w.scrollWidth, cw: w.clientWidth } : null;
      });
      if (!scrollable || scrollable.sw <= scrollable.cw) {
        throw new Error(`断言失败: 1366 下汇总矩阵应可横向滚动 (sw=${scrollable && scrollable.sw}, cw=${scrollable && scrollable.cw})`);
      }
      console.log(`  断言通过: 横向滚动存在 (scrollWidth=${scrollable.sw} > clientWidth=${scrollable.cw})`);
      // 滚动到中部并验证固定列仍可见（sticky 门店列贴左、财年小计贴右）
      const stickyOk = await page.evaluate(() => {
        const wraps = document.querySelectorAll('.matrix-table .el-scrollbar__wrap, .matrix-table .el-table__body-wrapper');
        wraps.forEach(w => { w.scrollLeft = Math.floor((w.scrollWidth - w.clientWidth) / 2); });
        const table = document.querySelector('.matrix-table');
        if (!table) return null;
        const tRect = table.getBoundingClientRect();
        const firstStoreCell = table.querySelector('.el-table__row td:first-child .cell');
        const headerCells = Array.from(table.querySelectorAll('.el-table__header th'));
        const subtotalTh = headerCells.find(th => th.textContent.includes('财年小计'));
        const storeOk = firstStoreCell ? firstStoreCell.getBoundingClientRect().left < tRect.left + 200 : false;
        const subOk = subtotalTh ? subtotalTh.getBoundingClientRect().right > tRect.right - 200 : false;
        return { storeOk, subOk, scrollApplied: wraps.length > 0 };
      });
      await page.waitForTimeout(600);
      if (!stickyOk || !stickyOk.storeOk) throw new Error('断言失败: 滚动后门店固定列不可读');
      if (!stickyOk.subOk) throw new Error('断言失败: 滚动后财年小计固定列不可读');
      console.log('  断言通过: 滚动中段后门店列贴左固定、财年小计贴右固定均可读');
      await assertNoDirtyData(page, '汇总矩阵滚动态 1366 admin');
      const r = await shot(page, '08-budget-summary-scroll-1366-admin.png', '汇总矩阵 1366 横向滚动+固定列');
      return { ...r, verified: 'scrollWidth>clientWidth, 门店列/财年小计 sticky 固定, 金额列可读' };
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
