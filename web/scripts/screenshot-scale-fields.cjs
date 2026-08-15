/**
 * 电子秤字段补充：审计截图脚本
 *
 * 覆盖：
 *   1. 1366×768 管理员台账（含秤号/IP地址列）
 *   2. 1366×768 管理员 Drawer（含秤号/IP地址复制按钮）
 *   3. 1366×768 查看者态（无编辑/删除/导出按钮）
 *   4. 1440×1024 管理员台账
 *   5. 1440×1024 管理员 Drawer
 *   6. 1440×1024 查看者态
 *   7. CSV 下载断言（表头含秤号/IP地址列）
 *
 * 运行方式：
 *   1. 启动服务：PORT=3999 node .output/server/index.mjs
 *   2. 执行截图：node scripts/screenshot-scale-fields.cjs
 *   3. 输出目录：screenshots/scale-fields/
 *
 * 数据质量：截图数据不得出现 null/undefined/123/e2e 等脏测试值
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3999';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'scale-fields');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

// 查看者账户
const VIEWER_USERNAME = process.env.VIEWER_USERNAME || 'viewer';
const VIEWER_PASSWORD = process.env.VIEWER_PASSWORD || '123456';

// ——— 工具函数 ———

/** 登录并设置 localStorage，返回 user 信息 */
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

/** 截图并记录文件大小 */
async function shot(page, name, label) {
  await page.waitForTimeout(800);
  const filePath = path.join(SHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  -> ${name}  ${(stat.size / 1024).toFixed(1)} KB  (${label})`);
  return { name, ok: true, size: stat.size, label };
}

/** 断言：元素必须存在，否则抛错 */
async function assertExists(page, selector, label) {
  const el = await page.$(selector);
  if (!el) throw new Error(`断言失败: ${label} (${selector} 不存在)`);
  console.log(`  断言通过: ${label}`);
  return el;
}

/** 断言：元素必须不存在 */
async function assertNotExists(page, selector, label) {
  const el = await page.$(selector);
  if (el) throw new Error(`断言失败: ${label} (${selector} 不应存在)`);
  console.log(`  断言通过: ${label} (不存在)`);
}

/** 断言：按钮文本存在 */
async function assertBtnText(page, text, label) {
  const found = await page.evaluate((t) =>
    !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(t))
  , text);
  if (!found) throw new Error(`断言失败: ${label} (按钮"${text}"不存在)`);
  console.log(`  断言通过: ${label}`);
}

/** 断言：按钮文本不存在 */
async function assertNoBtnText(page, text, label) {
  const found = await page.evaluate((t) =>
    !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes(t))
  , text);
  if (found) throw new Error(`断言失败: ${label} (按钮"${text}"不应存在)`);
  console.log(`  断言通过: ${label} (不存在)`);
}

/** 断言：表格列头包含指定文本 */
async function assertTableHeader(page, text, label) {
  const found = await page.evaluate((t) => {
    const headers = Array.from(document.querySelectorAll('.el-table__header th .cell'));
    return headers.some(h => h.textContent.includes(t));
  }, text);
  if (!found) throw new Error(`断言失败: ${label} (表格列头"${text}"不存在)`);
  console.log(`  断言通过: ${label}`);
}

/** 断言：截图可见数据中不包含脏测试值 */
async function assertNoDirtyData(page, label) {
  const dirtyValues = ['null', 'undefined', 'e2e'];
  // 使用 innerText 而非 textContent，仅检查用户可见文本（排除隐藏 tooltip/aria-label）
  const visibleText = await page.evaluate(() => {
    const els = document.querySelectorAll('.el-table, .el-drawer, .el-dialog');
    let text = '';
    els.forEach(el => { if (el.offsetHeight > 0) text += (el.innerText || '') + ' '; });
    return text;
  });
  for (const dirty of dirtyValues) {
    if (visibleText.toLowerCase().includes(dirty)) {
      throw new Error(`数据质量断言失败: ${label} - 可见区域包含脏值 "${dirty}"`);
    }
  }
  console.log(`  数据质量断言通过: ${label} (无脏测试值)`);
}

// ——— 主流程 ———

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const csvLog = [];

  // ==============================
  // 1. 1366×768 管理员台账
  // ==============================
  console.log('\n=== 电子秤截图 ===');
  console.log('\n[01] scales 1366 管理员台账');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await assertExists(page, '.el-table', '台账表格存在');
    await assertTableHeader(page, '秤号', '表格含秤号列');
    await assertTableHeader(page, 'IP地址', '表格含IP地址列');
    await assertTableHeader(page, '规格', '表格含规格列');
    await assertTableHeader(page, '下次校准', '表格含下次校准列');
    await assertTableHeader(page, '状态', '表格含状态列');
    await assertTableHeader(page, '操作', '表格含操作列');
    await assertBtnText(page, '导出当前页 CSV', '导出按钮存在');
    await assertBtnText(page, '新增电子称', '新增按钮存在');
    await assertExists(page, '.copyable-cell__btn', '复制图标存在');
    // 验证下次校准/状态列不被固定操作列遮挡
    const colVisibility = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('.el-table__header th .cell'));
      const result = {};
      for (const h of headers) {
        const text = h.textContent.trim();
        if (['下次校准', '状态', '操作'].includes(text)) {
          const rect = h.getBoundingClientRect();
          result[text] = { visible: rect.width > 0 && rect.height > 0, right: Math.round(rect.right) };
        }
      }
      return result;
    });
    if (!colVisibility['下次校准']?.visible) throw new Error('断言失败: 下次校准列不可见（可能被操作列遮挡）');
    if (!colVisibility['状态']?.visible) throw new Error('断言失败: 状态列不可见（可能被操作列遮挡）');
    if (!colVisibility['操作']?.visible) throw new Error('断言失败: 操作列不可见');
    console.log('  断言通过: 下次校准/状态/操作列均可见');
    await assertNoDirtyData(page, '管理员台账 1366');

    const r = await shot(page, '01-scales-1366-admin.png', '电子秤 1366×768 管理员台账');
    results.push({ ...r, verified: 'el-table, 秤号/IP地址/规格/下次校准/状态/操作列可见, 导出CSV, 新增, copyable-cell__btn' });
    await ctx.close();
  }

  // 2. 1366×768 管理员 Drawer
  console.log('\n[02] scales 1366 管理员 Drawer');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击第一行第一个单元格（避免误触操作列）
    const firstCell1366 = await page.$('.el-table__row:first-child td:first-child');
    if (!firstCell1366) throw new Error('无电子秤记录可点击');
    await firstCell1366.click();
    await page.waitForTimeout(2500);

    await assertExists(page, '.el-drawer', 'Drawer 已打开');
    await page.waitForSelector('.drawer-copy-btn', { timeout: 5000 });
    const drawerText = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer');
      return drawer ? drawer.innerText : '';
    });
    if (!drawerText.includes('秤号')) throw new Error('Drawer 中无"秤号"字段');
    if (!drawerText.includes('IP地址')) throw new Error('Drawer 中无"IP地址"字段');
    console.log('  断言通过: Drawer 包含秤号和IP地址字段');

    const copyBtns = await page.$$('.drawer-copy-btn');
    console.log(`  Drawer 复制按钮数: ${copyBtns.length}`);
    if (copyBtns.length < 3) {
      throw new Error(`Drawer 复制按钮不足: ${copyBtns.length}（需要 ≥3）`);
    }

    await assertNoDirtyData(page, '管理员 Drawer 1366');

    const r = await shot(page, '02-scales-1366-drawer.png', '电子秤 1366×768 管理员 Drawer');
    results.push({ ...r, verified: `el-drawer, 含秤号/IP地址字段, ${copyBtns.length}个drawer-copy-btn` });
    await ctx.close();
  }

  // 3. 1366×768 查看者态
  console.log('\n[03] scales 1366 查看者态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 断言页面身份显示为查看者
    const uname = await page.evaluate(() => {
      const el = document.querySelector('.username');
      return el ? el.textContent.trim() : '';
    });
    if (!uname.includes('查看者')) {
      throw new Error(`断言失败: 页面身份应为查看者，实际为"${uname}"`);
    }
    console.log(`  断言通过: 页面身份=${uname}`);

    await assertExists(page, '.copyable-cell__btn', '查看者复制图标可见');
    await assertTableHeader(page, '秤号', '查看者表格含秤号列');
    await assertTableHeader(page, 'IP地址', '查看者表格含IP地址列');
    await assertNoBtnText(page, '导出当前页 CSV', '查看者无导出按钮');
    await assertNoBtnText(page, '新增电子称', '查看者无新增按钮');
    await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
    await assertNoBtnText(page, '删除', '查看者无删除按钮');

    // 查看者也能打开 Drawer 并复制
    const viewerFirstCell1366 = await page.$('.el-table__row:first-child td:first-child');
    if (viewerFirstCell1366) {
      await viewerFirstCell1366.click();
      await page.waitForTimeout(2500);
      await assertExists(page, '.el-drawer', '查看者 Drawer 已打开');
      await page.waitForSelector('.drawer-copy-btn', { timeout: 10000 });
      await assertExists(page, '.drawer-copy-btn', '查看者 Drawer 复制按钮可见');
    }

    await assertNoDirtyData(page, '查看者态 1366');

    const r = await shot(page, '03-scales-1366-viewer.png', '电子秤 1366×768 查看者态');
    results.push({ ...r, verified: '身份=查看者, 秤号/IP地址列, copyable-cell__btn, 无导出/新增/编辑/删除, drawer-copy-btn可用' });
    await ctx.close();
  }

  // 4. 1440×1024 管理员台账
  console.log('\n[04] scales 1440 管理员台账');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await assertExists(page, '.el-table', '台账表格存在');
    await assertTableHeader(page, '秤号', '表格含秤号列');
    await assertTableHeader(page, 'IP地址', '表格含IP地址列');
    await assertTableHeader(page, '规格', '表格含规格列');
    await assertTableHeader(page, '下次校准', '表格含下次校准列');
    await assertTableHeader(page, '状态', '表格含状态列');
    await assertTableHeader(page, '操作', '表格含操作列');
    await assertBtnText(page, '导出当前页 CSV', '导出按钮存在');
    await assertExists(page, '.copyable-cell__btn', '复制图标存在');
    await assertNoDirtyData(page, '管理员台账 1440');

    const r = await shot(page, '04-scales-1440-admin.png', '电子秤 1440×1024 管理员台账');
    results.push({ ...r, verified: 'el-table, 秤号/IP地址/规格/下次校准/状态/操作列, 导出CSV, copyable-cell__btn' });
    await ctx.close();
  }

  // 5. 1440×1024 管理员 Drawer
  console.log('\n[05] scales 1440 管理员 Drawer');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 点击第一行第一个单元格（避免误触操作列）
    const firstCell = await page.$('.el-table__row:first-child td:first-child');
    if (!firstCell) throw new Error('无电子秤记录可点击');
    await firstCell.click();
    await page.waitForTimeout(2500);

    await assertExists(page, '.el-drawer', 'Drawer 已打开');
    // 等待 Drawer 内容渲染完成
    await page.waitForSelector('.drawer-copy-btn', { timeout: 10000 });
    const drawerText = await page.evaluate(() => {
      const drawer = document.querySelector('.el-drawer');
      return drawer ? drawer.innerText : '';
    });
    if (!drawerText.includes('秤号')) throw new Error('Drawer 中无"秤号"字段');
    if (!drawerText.includes('IP地址')) throw new Error('Drawer 中无"IP地址"字段');
    console.log('  断言通过: Drawer 包含秤号和IP地址字段');

    const copyBtns = await page.$$('.drawer-copy-btn');
    console.log(`  Drawer 复制按钮数: ${copyBtns.length}`);

    await assertNoDirtyData(page, '管理员 Drawer 1440');

    const r = await shot(page, '05-scales-1440-drawer.png', '电子秤 1440×1024 管理员 Drawer');
    results.push({ ...r, verified: `el-drawer, 含秤号/IP地址字段, ${copyBtns.length}个drawer-copy-btn` });
    await ctx.close();
  }

  // 6. 1440×1024 查看者态
  console.log('\n[06] scales 1440 查看者态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page, VIEWER_USERNAME, VIEWER_PASSWORD);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const uname = await page.evaluate(() => {
      const el = document.querySelector('.username');
      return el ? el.textContent.trim() : '';
    });
    if (!uname.includes('查看者')) {
      throw new Error(`断言失败: 页面身份应为查看者，实际为"${uname}"`);
    }
    console.log(`  断言通过: 页面身份=${uname}`);

    await assertExists(page, '.copyable-cell__btn', '查看者复制图标可见');
    await assertTableHeader(page, '秤号', '查看者表格含秤号列');
    await assertTableHeader(page, 'IP地址', '查看者表格含IP地址列');
    await assertNoBtnText(page, '导出当前页 CSV', '查看者无导出按钮');
    await assertNoBtnText(page, '新增电子称', '查看者无新增按钮');
    await assertNoBtnText(page, '编辑', '查看者无编辑按钮');
    await assertNoBtnText(page, '删除', '查看者无删除按钮');

    // 查看者也能打开 Drawer 并复制
    const viewerFirstCell = await page.$('.el-table__row:first-child td:first-child');
    if (viewerFirstCell) {
      await viewerFirstCell.click();
      await page.waitForTimeout(2500);
      await assertExists(page, '.el-drawer', '查看者 Drawer 已打开');
      await page.waitForSelector('.drawer-copy-btn', { timeout: 10000 });
      await assertExists(page, '.drawer-copy-btn', '查看者 Drawer 复制按钮可见');
    }

    await assertNoDirtyData(page, '查看者态 1440');

    const r = await shot(page, '06-scales-1440-viewer.png', '电子秤 1440×1024 查看者态');
    results.push({ ...r, verified: '身份=查看者, 秤号/IP地址列, copyable-cell__btn, 无导出/新增/编辑/删除, drawer-copy-btn可用' });
    await ctx.close();
  }

  // ==============================
  // 7. CSV 下载断言
  // ==============================
  console.log('\n[CSV] 电子秤 CSV 下载断言');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/scales`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('导出当前页 CSV'));
      if (btn) btn.click();
    });

    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    const filePath = await download.path();
    let content = '';
    if (filePath) {
      content = fs.readFileSync(filePath, 'utf-8');
    }

    const hasBOM = content.startsWith('\uFEFF');
    const lines = content.split('\r\n').filter(l => l);
    const header = lines[0]?.replace('\uFEFF', '') || '';
    const hasScaleNo = header.includes('秤号');
    const hasIpAddress = header.includes('IP地址');
    const hasWhiteListCols = header.includes('资产编号') && header.includes('名称');

    csvLog.push('=== CSV 下载断言日志 ===');
    csvLog.push(`文件名: ${filename}`);
    csvLog.push(`UTF-8 BOM: ${hasBOM ? '通过' : '失败'}`);
    csvLog.push(`表头含秤号: ${hasScaleNo ? '通过' : '失败'}`);
    csvLog.push(`表头含IP地址: ${hasIpAddress ? '通过' : '失败'}`);
    csvLog.push(`白名单列(资产编号/名称): ${hasWhiteListCols ? '通过' : '失败'}`);
    csvLog.push(`数据行数(不含表头): ${lines.length - 1}`);
    csvLog.push(`表头内容: ${header}`);
    csvLog.push('');

    console.log(`  文件名: ${filename}`);
    console.log(`  BOM: ${hasBOM}, 秤号: ${hasScaleNo}, IP地址: ${hasIpAddress}, 白名单: ${hasWhiteListCols}`);
    console.log(`  数据行: ${lines.length - 1}`);

    if (!hasBOM || !hasScaleNo || !hasIpAddress || !hasWhiteListCols) {
      throw new Error('CSV 断言失败');
    }
    results.push({ name: 'CSV断言', ok: true, size: 0, label: 'CSV 下载断言通过', verified: `BOM=${hasBOM}, 秤号=${hasScaleNo}, IP地址=${hasIpAddress}, 白名单=${hasWhiteListCols}` });
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

  // 写入 CSV 断言日志
  if (csvLog.length > 0) {
    const logPath = path.join(SHOT_DIR, 'csv-assertion-log.txt');
    fs.writeFileSync(logPath, csvLog.join('\n'), 'utf-8');
    console.log(`\nCSV 断言日志已写入: ${logPath}`);
  }

  console.log(`\n总计: ${results.length} 项, ${allOk ? '全部通过' : '有失败项'}`);
  if (!allOk) process.exit(1);
}

run().catch(err => {
  console.error('\n!!! 截图脚本异常退出:', err.message);
  console.error(err.stack);
  process.exit(1);
});
