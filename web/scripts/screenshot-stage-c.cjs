/**
 * 阶段 C 审计截图：network-devices + domains + 服务器 Overlay
 * 1366×768 与 1440×1024，Playwright headless
 * 含校验：关键元素检测、每段 try-catch 容错
 *
 * 注意：服务器凭据 Dialog 需在树形列表视图下点击 "更多" → "服务器凭据"。
 * 卡片视图的 "更多" 按钮在 ServerHostCard 组件内，下拉项不同。
 * 拓扑图用 ECharts Canvas 渲染，Drawer 通过 canvas 点击触发；
 * 若设备数据为 null，Drawer 复制按钮不显示（v-if="f.value !== '—'"）。
 *
 * 运行方式：
 *   1. 启动服务：node .output/server/index.mjs（PORT=3999）
 *   2. 执行截图：node scripts/screenshot-stage-c.cjs
 *   3. 输出目录：screenshots/stage-c/
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3999';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'stage-c');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

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
  console.log(`  登录(${username}):`, result.success ? '成功' : '失败 - ' + result.error);
  if (!result.success) throw new Error('Login failed: ' + result.error);
  return result.user;
}

async function shot(page, name, label) {
  await page.waitForTimeout(1500);
  const filePath = path.join(SHOT_DIR, name);
  await page.screenshot({ path: filePath, fullPage: true });
  const stat = fs.statSync(filePath);
  console.log(`  -> ${name}  ${(stat.size / 1024).toFixed(1)} KB  (${label})`);
  return { name, ok: true, size: stat.size, label };
}

async function tryShot(name, label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.log(`  !! ${label} 失败: ${err.message.split('\n')[0]}`);
    return { name, ok: false, size: 0, label: label + '（失败）' };
  }
}

// ——— 主流程 ———

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];

  // ==============================
  // 1. network-devices 页面
  // ==============================
  console.log('\n=== network-devices 截图 ===');

  // 1a. 1366×768 管理员正常态（含导出按钮）
  results.push(await tryShot('01-network-devices-1366-admin.png', 'network-devices 1366 管理员正常态', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const hasTable = await page.$('.el-table');
    const hasExportBtn = await page.evaluate(() =>
      !!Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('导出当前页 CSV'))
    );
    console.log(`  校验: table=${!!hasTable}, exportBtn=${hasExportBtn}`);

    const r = await shot(page, '01-network-devices-1366-admin.png', '网络设备 1366×768 管理员正常态');
    await ctx.close();
    return r;
  }));

  // 1b. 1366×768 Drawer 字段复制（通过拓扑 Tab 打开）
  results.push(await tryShot('02-network-devices-1366-drawer-copy.png', 'network-devices 1366 Drawer 字段复制', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 切换到拓扑 Tab
    const switched = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.el-tabs__item'));
      const topoTab = tabs.find(t => t.textContent.includes('网络拓扑'));
      if (topoTab) { topoTab.click(); return true; }
      return false;
    });
    console.log(`  切换拓扑Tab: ${switched}`);
    await page.waitForTimeout(3000);

    // 尝试点击拓扑图中的节点（SVG circle 或 g 节点）
    const nodeClicked = await page.evaluate(() => {
      // 尝试 SVG 节点
      const svgNodes = document.querySelectorAll('svg circle, svg g[class*="node"], svg g[class*="device"], .topology-node, [class*="topo"] circle');
      if (svgNodes.length > 0) {
        svgNodes[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
      // 尝试 canvas 点击（某些拓扑用 canvas）
      return false;
    });
    console.log(`  拓扑节点点击: ${nodeClicked}`);
    await page.waitForTimeout(2000);

    const drawer = await page.$('.el-drawer');
    if (drawer) {
      const copyBtns = await page.$$('.drawer-copy-btn');
      console.log(`  Drawer 打开, 复制按钮数: ${copyBtns.length}`);
    } else {
      console.log('  Drawer 未打开（拓扑可能无节点），截图当前拓扑视图');
    }

    const r = await shot(page, '02-network-devices-1366-drawer-copy.png', '网络设备 Drawer/拓扑视图');
    await ctx.close();
    return r;
  }));

  // 1c. 1440×1024 管理员正常态
  results.push(await tryShot('03-network-devices-1440-admin.png', 'network-devices 1440 管理员正常态', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const r = await shot(page, '03-network-devices-1440-admin.png', '网络设备 1440×1024 管理员正常态');
    await ctx.close();
    return r;
  }));

  // ==============================
  // 2. domains 页面
  // ==============================
  console.log('\n=== domains 截图 ===');

  // 2a. 1366×768 卡片态（含编辑/删除平铺）
  results.push(await tryShot('04-domains-1366-card.png', 'domains 1366 卡片态', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    const cards = await page.$$('.service-card');
    console.log(`  卡片数: ${cards.length}`);

    const r = await shot(page, '04-domains-1366-card.png', '域名管理 1366×768 卡片态');
    await ctx.close();
    return r;
  }));

  // 2b. 1366×768 列表态
  results.push(await tryShot('05-domains-1366-list.png', 'domains 1366 列表态', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const listBtn = btns.find(b => b.textContent.includes('列表'));
      if (listBtn) listBtn.click();
    });
    await page.waitForTimeout(1000);

    const r = await shot(page, '05-domains-1366-list.png', '域名管理 1366×768 列表态');
    await ctx.close();
    return r;
  }));

  // 2c. 1366×768 Drawer
  results.push(await tryShot('06-domains-1366-drawer.png', 'domains 1366 Drawer', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    // 用 evaluate 点击卡片，避免 Playwright 可见性检测问题
    const clicked = await page.evaluate(() => {
      const card = document.querySelector('.service-card');
      if (card) {
        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
      return false;
    });
    console.log(`  卡片点击: ${clicked}`);
    await page.waitForTimeout(1500);

    const drawer = await page.$('.el-drawer');
    if (drawer) {
      const copyBtn = await page.$('.drawer-copy-btn');
      console.log(`  Drawer 打开, 域名复制按钮: ${!!copyBtn}`);
    } else {
      console.log('  Drawer 未打开');
    }

    const r = await shot(page, '06-domains-1366-drawer.png', '域名管理 1366×768 Drawer');
    await ctx.close();
    return r;
  }));

  // 2d. 1440×1024 卡片态
  results.push(await tryShot('07-domains-1440-card.png', 'domains 1440 卡片态', async () => {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    const r = await shot(page, '07-domains-1440-card.png', '域名管理 1440×1024 卡片态');
    await ctx.close();
    return r;
  }));

  // ==============================
  // 3. 服务器 Overlay 验证
  // ==============================
  console.log('\n=== 服务器 Overlay 截图 ===');

  // 3a. 服务器详情 → 更多 → 凭据 Dialog → 清除确认
  try {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);

    // 获取服务器列表找到有效 ID
    await page.goto(`${BASE}/it/servers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const serverLink = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/it/servers/"]'));
      const detail = links.find(l => !l.href.endsWith('/it/servers') && !l.href.includes('/it/servers?'));
      return detail ? detail.href : null;
    });

    let detailUrl = serverLink || `${BASE}/it/servers/7`;
    console.log(`  服务器详情URL: ${detailUrl}`);

    await page.goto(detailUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 截图服务器详情页
    results.push(await shot(page, '08-server-detail.png', '服务器详情页'));

    // 点击 "更多" 下拉
    const moreClicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const more = btns.find(b => b.textContent.includes('更多'));
      if (more) { more.click(); return true; }
      return false;
    });
    console.log(`  更多按钮点击: ${moreClicked}`);

    if (moreClicked) {
      await page.waitForTimeout(800);
      results.push(await shot(page, '09-server-more-dropdown.png', '服务器详情 → 更多下拉'));

      // 点击 "服务器凭据"
      const credClicked = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item'));
        const cred = items.find(i => i.textContent.includes('凭据'));
        if (cred) { cred.click(); return true; }
        return false;
      });
      console.log(`  凭据菜单点击: ${credClicked}`);

      if (credClicked) {
        await page.waitForTimeout(1500);
        const dialog = await page.$('.el-dialog');
        if (dialog) {
          console.log('  凭据 Dialog 打开');
          results.push(await shot(page, '10-server-credential-dialog.png', '服务器凭据 Dialog'));

          // 尝试找清除按钮
          const clearClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('.el-dialog button'));
            const clear = btns.find(b => b.textContent.includes('清除'));
            if (clear) { clear.click(); return true; }
            return false;
          });

          if (clearClicked) {
            await page.waitForTimeout(1000);
            results.push(await shot(page, '11-server-credential-clear-confirm.png', '凭据清除确认'));
            console.log('  清除确认弹窗已截图');

            // 取消确认
            await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('button'));
              const cancel = btns.find(b => b.textContent.trim() === '取消');
              if (cancel) cancel.click();
            });
            await page.waitForTimeout(500);
          } else {
            console.log('  未找到清除按钮（可能无凭据数据）');
          }
        } else {
          console.log('  凭据 Dialog 未打开');
          results.push(await shot(page, '10-server-credential-dialog.png', '凭据 Dialog（未打开）'));
        }
      } else {
        console.log('  未找到凭据菜单项');
      }
    } else {
      console.log('  未找到更多按钮');
    }

    await ctx.close();
  } catch (err) {
    console.log(`  !! 服务器 Overlay 截图失败: ${err.message.split('\n')[0]}`);
  }

  // ==============================
  // 汇总
  // ==============================
  await browser.close();

  console.log('\n=== 阶段C截图汇总 ===');
  let allOk = true;
  for (const r of results) {
    if (!r) continue;
    const fp = path.join(SHOT_DIR, r.name);
    const exists = fs.existsSync(fp);
    const stat = exists ? fs.statSync(fp) : null;
    const kb = stat ? (stat.size / 1024).toFixed(1) : 'N/A';
    const status = r.ok && exists && stat && stat.size > 0 ? 'OK  ' : 'WARN';
    if (!r.ok || !exists || !stat || stat.size === 0) allOk = false;
    console.log(`  ${status} ${r.name}  ${kb} KB  ${r.label || ''}`);
  }
  console.log(allOk ? '\n所有截图完成' : '\n部分截图降级，请检查上方日志');
}

run().catch(err => {
  console.error('截图脚本失败:', err);
  process.exit(1);
});
