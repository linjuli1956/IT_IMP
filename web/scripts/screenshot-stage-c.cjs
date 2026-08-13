/**
 * 阶段 C 审计截图（收口版）：network-devices + domains + 服务器 Overlay
 *
 * 每张截图必须断言目标元素存在；目标未打开就应失败退出，不保存"当前页面"后标记成功。
 *
 * 覆盖：
 *   1. network-devices: 1366 admin 台账 / 1366 Drawer 复制 / 1440 admin / 1366 viewer / CSV 断言日志
 *   2. domains: 1366 admin 卡片 / 1366 admin 列表 / 1366 Drawer 复制 / 1440 admin 卡片 / 1366 viewer
 *   3. servers Overlay: Drawer Footer 更多 → 凭据 Dialog 更多 → 清除确认 MessageBox
 *
 * 运行方式：
 *   1. 启动服务：DATABASE_URL=mysql://... PORT=3999 node .output/server/index.mjs
 *   2. 执行截图：node scripts/screenshot-stage-c.cjs
 *   3. 输出目录：screenshots/stage-c/
 *
 * 技术要点：
 *   - 网络设备 Drawer 仅从拓扑 Tab 点击节点打开（ECharts Canvas，力导向布局）
 *   - 通过 Canvas 像素扫描找到节点圆心坐标，精确点击
 *   - 服务器 Drawer Footer "更多" 在 AssetDetailDrawer 底部 .action-text--info
 *   - 凭据 Dialog 的"更多"在 el-dialog footer，下拉项 teleport 到 body
 *   - 查看者态通过修改 localStorage role 为"查看者"模拟（token 不变）
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

/** 将 localStorage role 改为查看者（token 不变，仅前端 UI 层面） */
async function switchToViewer(page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('user_info');
    if (raw) {
      const u = JSON.parse(raw);
      u.role = '查看者';
      localStorage.setItem('user_info', JSON.stringify(u));
    }
  });
  console.log('  切换查看者角色 (localStorage)');
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

/** 等待 Element Plus dropdown 菜单可见，返回可见的菜单 */
async function waitForVisibleDropdown(page) {
  for (let i = 0; i < 20; i++) {
    const menus = await page.$$('.el-dropdown-menu');
    for (const menu of menus) {
      const visible = await menu.isVisible();
      if (visible) return menu;
    }
    await page.waitForTimeout(200);
  }
  return null;
}

/** 点击可见 dropdown 中包含指定文本的菜单项 */
async function clickDropdownItem(page, text) {
  const menu = await waitForVisibleDropdown(page);
  if (!menu) throw new Error(`dropdown 菜单未出现 (尝试点击 "${text}")`);

  const items = await menu.$$('.el-dropdown-menu__item');
  for (const item of items) {
    const itemText = await item.textContent();
    if (itemText.includes(text)) {
      await item.click();
      console.log(`  点击 dropdown 项: "${text}"`);
      return true;
    }
  }
  throw new Error(`dropdown 菜单中未找到 "${text}"`);
}

/**
 * 通过 Canvas 像素扫描找到 ECharts 力导向布局的节点位置。
 * 读取画布像素数据，找非背景像素，按颜色和距离聚类，返回节点圆心视口坐标。
 */
async function findNodePositionsViaCanvas(page) {
  const positions = await page.evaluate(() => {
    const canvas = document.querySelector('.topology-chart canvas');
    if (!canvas) return { error: 'no canvas' };

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let imageData;
    try {
      imageData = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      return { error: 'getImageData failed: ' + e.message };
    }
    const data = imageData.data;

    // 采样：每隔 step 像素取一个点
    const step = 3;
    const coloredPixels = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // 跳过透明像素
        if (a < 128) continue;
        // 跳过白色/浅色背景
        if (r > 235 && g > 235 && b > 235) continue;

        coloredPixels.push({ x, y, r, g, b });
      }
    }

    if (coloredPixels.length === 0) return { error: 'no colored pixels found', canvasW: w, canvasH: h };

    // 按距离和颜色相似度聚类
    const clusters = [];
    const distThreshold = 25; // 像素距离阈值
    const colorThreshold = 40; // 颜色差异阈值（每通道）

    for (const p of coloredPixels) {
      let added = false;
      for (const c of clusters) {
        const dx = p.x - c.cx;
        const dy = p.y - c.cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < distThreshold) {
          const dr = Math.abs(p.r - c.avgR);
          const dg = Math.abs(p.g - c.avgG);
          const db = Math.abs(p.b - c.avgB);
          if (dr < colorThreshold && dg < colorThreshold && db < colorThreshold) {
            c.pixels.push(p);
            c.cx = c.pixels.reduce((s, pp) => s + pp.x, 0) / c.pixels.length;
            c.cy = c.pixels.reduce((s, pp) => s + pp.y, 0) / c.pixels.length;
            c.avgR = c.pixels.reduce((s, pp) => s + pp.r, 0) / c.pixels.length;
            c.avgG = c.pixels.reduce((s, pp) => s + pp.g, 0) / c.pixels.length;
            c.avgB = c.pixels.reduce((s, pp) => s + pp.b, 0) / c.pixels.length;
            added = true;
            break;
          }
        }
      }
      if (!added) {
        clusters.push({
          cx: p.x, cy: p.y,
          avgR: p.r, avgG: p.g, avgB: p.b,
          pixels: [p]
        });
      }
    }

    // 过滤：节点是较大的彩色圆形（symbolSize=45/60，半径 22/30）
    // 采样 step=3，圆形面积 π*22² ≈ 1520，采样约 1520/9 ≈ 169 像素
    // 排除底部 15% 区域（图例）和右上角（工具箱）
    const legendStart = h * 0.85;
    const nodeClusters = clusters
      .filter(c => c.pixels.length > 20)
      .filter(c => c.cy < legendStart)
      .sort((a, b) => b.pixels.length - a.pixels.length);

    // 转换为视口坐标
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / w;
    const scaleY = rect.height / h;

    return {
      canvasW: w,
      canvasH: h,
      rectX: rect.x,
      rectY: rect.y,
      rectW: rect.width,
      rectH: rect.height,
      coloredPixelCount: coloredPixels.length,
      clusterCount: clusters.length,
      nodes: nodeClusters.slice(0, 5).map(c => ({
        x: rect.x + c.cx * scaleX,
        y: rect.y + c.cy * scaleY,
        pixelCount: c.pixels.length,
        color: `rgb(${Math.round(c.avgR)},${Math.round(c.avgG)},${Math.round(c.avgB)})`
      }))
    };
  });

  return positions;
}

/**
 * 通过像素扫描找到节点位置，逐个点击直到 Drawer 打开且有足够复制按钮。
 * 如果像素扫描失败，回退到中心区域精细网格扫描。
 */
async function openDrawerViaPixelScan(page, minCopyButtons = 3) {
  // 等待力导向布局稳定
  console.log('  等待力导向布局稳定 (8s)...');
  await page.waitForTimeout(8000);

  // 像素扫描找节点
  console.log('  扫描 Canvas 像素找节点位置...');
  const scanResult = await findNodePositionsViaCanvas(page);

  if (scanResult.error) {
    console.log(`  像素扫描失败: ${scanResult.error}`);
  } else {
    console.log(`  像素扫描: ${scanResult.coloredPixelCount} 个彩色像素, ${scanResult.clusterCount} 个聚类, ${scanResult.nodes.length} 个候选节点`);
    scanResult.nodes.forEach((n, i) => {
      console.log(`    节点 ${i + 1}: (${Math.round(n.x)}, ${Math.round(n.y)}) ${n.pixelCount}px ${n.color}`);
    });
  }

  // 尝试点击每个候选节点
  if (scanResult.nodes && scanResult.nodes.length > 0) {
    for (let i = 0; i < scanResult.nodes.length; i++) {
      const node = scanResult.nodes[i];
      console.log(`  尝试点击节点 ${i + 1} at (${Math.round(node.x)}, ${Math.round(node.y)})...`);

      // 确保 Drawer 关闭
      const drawerEl = await page.$('.el-drawer');
      if (drawerEl) {
        const vis = await drawerEl.isVisible();
        if (vis) {
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // 点击节点中心
      await page.mouse.click(node.x, node.y);
      await page.waitForTimeout(1000);

      // 检查 Drawer 是否打开
      const drawer = await page.$('.el-drawer');
      if (!drawer) continue;
      const visible = await drawer.isVisible();
      if (!visible) continue;

      // 等待 Drawer 内容渲染
      await page.waitForTimeout(1000);
      const copyBtns = await page.$$('.drawer-copy-btn');
      console.log(`  Drawer 可见, 复制按钮=${copyBtns.length}`);

      if (copyBtns.length >= minCopyButtons) {
        return true;
      }

      // 复制按钮不足，关闭 Drawer 继续尝试
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // 回退：中心区域精细网格扫描
  console.log('  像素扫描未成功，回退到中心区域精细网格扫描...');
  const canvas = await page.$('.topology-chart canvas');
  if (!canvas) throw new Error('拓扑 canvas 不存在');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas boundingBox 为 null');

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // 以中心为原点，步长 20px 的精细网格
  const positions = [];
  for (let dx = -160; dx <= 160; dx += 20) {
    for (let dy = -80; dy <= 80; dy += 20) {
      positions.push({ x: cx + dx, y: cy + dy });
    }
  }

  console.log(`  精细网格: ${positions.length} 个位置`);

  for (let idx = 0; idx < positions.length; idx++) {
    const pos = positions[idx];

    // 确保 Drawer 关闭
    const drawerEl = await page.$('.el-drawer');
    if (drawerEl) {
      const vis = await drawerEl.isVisible();
      if (vis) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    await page.mouse.click(pos.x, pos.y);
    await page.waitForTimeout(600);

    const drawer = await page.$('.el-drawer');
    if (!drawer) continue;
    const visible = await drawer.isVisible();
    if (!visible) continue;

    await page.waitForTimeout(800);
    const copyBtns = await page.$$('.drawer-copy-btn');
    if (copyBtns.length >= minCopyButtons) {
      console.log(`  位置 ${idx + 1}/${positions.length}: 成功! 复制按钮=${copyBtns.length}`);
      return true;
    }

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  return false;
}

// ——— 主流程 ———

async function run() {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const csvLog = [];

  // ==============================
  // 1. network-devices
  // ==============================
  console.log('\n=== network-devices 截图 ===');

  // 1a. 1366×768 管理员台账
  console.log('\n[01] network-devices 1366 管理员台账');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await assertExists(page, '.el-table', '台账表格存在');
    await assertBtnText(page, '导出当前页 CSV', '导出按钮存在');
    await assertBtnText(page, '新增设备', '新增按钮存在');
    await assertExists(page, '.copyable-cell__btn', '复制图标存在');

    const r = await shot(page, '01-network-devices-1366-admin.png', '网络设备 1366×768 管理员台账');
    results.push({ ...r, ok: true, verified: 'el-table, 导出CSV, 新增设备, copyable-cell__btn' });
    await ctx.close();
  }

  // 1b. 1366×768 真实 Device Drawer（拓扑节点点击，复制按钮可见）
  console.log('\n[02] network-devices 1366 Device Drawer 复制按钮');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 切换到拓扑 Tab
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('.el-tabs__item'));
      const topoTab = tabs.find(t => t.textContent.includes('网络拓扑'));
      if (topoTab) topoTab.click();
    });
    await page.waitForTimeout(3000);

    // 通过像素扫描点击节点
    const opened = await openDrawerViaPixelScan(page);
    if (!opened) {
      throw new Error('无法通过 ECharts 点击打开 Device Drawer');
    }

    // 断言 Drawer 打开且有复制按钮
    await assertExists(page, '.el-drawer', 'Drawer 已打开');
    const copyBtns = await page.$$('.drawer-copy-btn');
    console.log(`  Drawer 复制按钮数: ${copyBtns.length}`);
    if (copyBtns.length < 3) {
      throw new Error(`Drawer 复制按钮不足: ${copyBtns.length}（需要 ≥3）`);
    }

    const r = await shot(page, '02-network-devices-1366-drawer.png', '网络设备 1366 Device Drawer 复制按钮');
    results.push({ ...r, ok: true, verified: `el-drawer, ${copyBtns.length}个drawer-copy-btn` });
    await ctx.close();
  }

  // 1c. 1440×1024 管理员台账
  console.log('\n[03] network-devices 1440 管理员台账');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1024 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await assertExists(page, '.el-table', '台账表格存在');
    await assertBtnText(page, '导出当前页 CSV', '导出按钮存在');

    const r = await shot(page, '03-network-devices-1440-admin.png', '网络设备 1440×1024 管理员台账');
    results.push({ ...r, ok: true, verified: 'el-table, 导出CSV' });
    await ctx.close();
  }

  // 1d. 1366×768 查看者态
  console.log('\n[04] network-devices 1366 查看者态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await switchToViewer(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await assertExists(page, '.copyable-cell__btn', '查看者复制图标可见');
    await assertNoBtnText(page, '导出当前页 CSV', '查看者无导出按钮');
    await assertNoBtnText(page, '新增设备', '查看者无新增按钮');

    const r = await shot(page, '04-network-devices-1366-viewer.png', '网络设备 1366×768 查看者态');
    results.push({ ...r, ok: true, verified: 'copyable-cell__btn存在, 无导出/新增按钮' });
    await ctx.close();
  }

  // 1e. CSV 下载断言日志
  console.log('\n[CSV] network-devices CSV 下载断言');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 监听下载
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
    const hasWhiteListCols = header.includes('品牌') && header.includes('管理IP') && header.includes('状态');
    const noSensitiveCols = !header.includes('序列号') && !header.includes('MAC');

    csvLog.push('=== CSV 下载断言日志 ===');
    csvLog.push(`文件名: ${filename}`);
    csvLog.push(`UTF-8 BOM: ${hasBOM ? '通过' : '失败'}`);
    csvLog.push(`表头白名单列(品牌/管理IP/状态): ${hasWhiteListCols ? '通过' : '失败'}`);
    csvLog.push(`排除敏感列(序列号/MAC): ${noSensitiveCols ? '通过' : '失败'}`);
    csvLog.push(`数据行数(不含表头): ${lines.length - 1}`);
    csvLog.push(`表头内容: ${header}`);
    csvLog.push('');

    console.log(`  文件名: ${filename}`);
    console.log(`  BOM: ${hasBOM}, 白名单: ${hasWhiteListCols}, 排除敏感: ${noSensitiveCols}`);
    console.log(`  数据行: ${lines.length - 1}`);

    if (!hasBOM || !hasWhiteListCols || !noSensitiveCols) {
      throw new Error('CSV 断言失败');
    }
    results.push({ name: 'CSV断言', ok: true, size: 0, label: 'CSV 下载断言通过', verified: `BOM=${hasBOM}, 白名单=${hasWhiteListCols}, 排除敏感=${noSensitiveCols}` });
    await ctx.close();
  }

  // ==============================
  // 2. domains
  // ==============================
  console.log('\n=== domains 截图 ===');

  // 2a. 1366×768 管理员卡片态
  console.log('\n[05] domains 1366 管理员卡片态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 确保卡片视图
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    await assertExists(page, '.service-card', '域名卡片存在');
    await assertExists(page, '.service-card__actions', '编辑/删除平铺可见');
    await assertBtnText(page, '编辑', '编辑按钮可见');
    await assertBtnText(page, '删除', '删除按钮可见');

    const r = await shot(page, '05-domains-1366-card.png', '域名管理 1366×768 管理员卡片态');
    results.push({ ...r, ok: true, verified: 'service-card, service-card__actions, 编辑/删除按钮' });
    await ctx.close();
  }

  // 2b. 1366×768 列表态
  console.log('\n[06] domains 1366 管理员列表态');
  {
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

    await assertExists(page, '.el-table', '域名列表表格存在');

    const r = await shot(page, '06-domains-1366-list.png', '域名管理 1366×768 列表态');
    results.push({ ...r, ok: true, verified: 'el-table' });
    await ctx.close();
  }

  // 2c. 1366×768 Drawer 域名复制按钮
  console.log('\n[07] domains 1366 Drawer 域名复制按钮');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 确保卡片视图
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    // 点击第一张卡片打开 Drawer
    const card = await page.$('.service-card');
    if (!card) throw new Error('无域名卡片可点击');
    await card.click();
    await page.waitForTimeout(1500);

    await assertExists(page, '.el-drawer', '域名 Drawer 已打开');
    await assertExists(page, '.drawer-copy-btn', '域名复制按钮可见');

    const r = await shot(page, '07-domains-1366-drawer.png', '域名管理 1366×768 Drawer 域名复制按钮');
    results.push({ ...r, ok: true, verified: 'el-drawer, drawer-copy-btn' });
    await ctx.close();
  }

  // 2d. 1440×1024 管理员卡片态
  console.log('\n[08] domains 1440 管理员卡片态');
  {
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

    await assertExists(page, '.service-card', '域名卡片存在');
    await assertExists(page, '.service-card__actions', '编辑/删除平铺可见');

    const r = await shot(page, '08-domains-1440-card.png', '域名管理 1440×1024 管理员卡片态');
    results.push({ ...r, ok: true, verified: 'service-card, service-card__actions' });
    await ctx.close();
  }

  // 2e. 1366×768 查看者态
  console.log('\n[09] domains 1366 查看者态');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await switchToViewer(page);
    await page.goto(`${BASE}/it/domains`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 确保卡片视图
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.el-radio-button__inner'));
      const cardBtn = btns.find(b => b.textContent.includes('卡片'));
      if (cardBtn) cardBtn.click();
    });
    await page.waitForTimeout(1000);

    await assertExists(page, '.service-card', '查看者域名卡片可见');
    await assertNotExists(page, '.service-card__actions', '查看者无编辑/删除按钮');
    await assertNoBtnText(page, '导出当前页 CSV', '查看者无导出按钮');
    await assertNoBtnText(page, '新增域名', '查看者无新增按钮');

    // 点击卡片打开 Drawer，确认域名复制按钮仍可用
    const card = await page.$('.service-card');
    if (card) {
      await card.click();
      await page.waitForTimeout(1500);
      await assertExists(page, '.drawer-copy-btn', '查看者域名复制按钮仍可用');
    }

    const r = await shot(page, '09-domains-1366-viewer.png', '域名管理 1366×768 查看者态');
    results.push({ ...r, ok: true, verified: 'service-card存在, 无actions/导出/新增, drawer-copy-btn可用' });
    await ctx.close();
  }

  // ==============================
  // 3. servers Overlay 链路
  // ==============================
  console.log('\n=== servers Overlay 链路截图 ===');

  // 在同一个 context 中完成 Overlay 链路：Drawer → 凭据 Dialog → 清除确认
  console.log('\n[10-12] servers Overlay 链路');
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page);
    await page.goto(`${BASE}/it/servers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 点击第一张服务器卡片打开 Drawer
    await page.waitForSelector('.server-card-grid > *', { timeout: 10000 });
    const card = await page.$('.server-card-grid > *');
    if (!card) throw new Error('无服务器卡片可点击');

    // 点击卡片上半区域（避免点到编辑/删除按钮）
    const box = await card.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.waitForTimeout(2000);

    await assertExists(page, '.el-drawer', '服务器 Drawer 已打开');

    // --- 10. 服务器 Drawer Footer "更多" 菜单 ---
    console.log('\n[10] 服务器 Drawer Footer 更多菜单');
    {
      // Drawer footer 内的"更多"按钮（AssetDetailDrawer 使用自定义 .drawer-footer，非 el-drawer__footer）
      await page.waitForTimeout(500);
      const moreBtn = await page.$('.drawer-footer .action-text--info');
      if (!moreBtn) throw new Error('Drawer Footer "更多" 按钮不存在');

      await moreBtn.click();
      await page.waitForTimeout(800);

      // 断言 dropdown 菜单可见，且包含"服务器凭据"
      const menu = await waitForVisibleDropdown(page);
      if (!menu) throw new Error('"更多" dropdown 菜单未出现');

      const hasCredential = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item'));
        return items.some(i => i.textContent.includes('凭据'));
      });
      if (!hasCredential) throw new Error('dropdown 菜单中无"服务器凭据"项');
      console.log('  断言通过: "更多"菜单包含"服务器凭据"项');

      const r = await shot(page, '10-server-drawer-more.png', '服务器 Drawer Footer 更多菜单');
      results.push({ ...r, ok: true, verified: '.drawer-footer .action-text--info, dropdown含"凭据"项' });
    }

    // --- 11. 点击"服务器凭据"打开 Dialog → Dialog "更多"菜单 ---
    console.log('\n[11] 服务器凭据 Dialog 更多菜单');
    {
      await clickDropdownItem(page, '凭据');
      await page.waitForTimeout(1500);

      await assertExists(page, '.el-dialog', '凭据 Dialog 已打开');

      // 找到 Dialog footer 中的"更多"按钮（el-button inside el-dropdown inside el-dialog__footer）
      const dialogMoreBtn = await page.$('.el-dialog__footer .el-dropdown .el-button');
      if (!dialogMoreBtn) throw new Error('凭据 Dialog "更多" 按钮不存在');

      await dialogMoreBtn.click();
      await page.waitForTimeout(800);

      // 断言 dropdown 菜单包含"清除已保存凭据"
      const menu2 = await waitForVisibleDropdown(page);
      if (!menu2) throw new Error('凭据 Dialog "更多" dropdown 未出现');

      const hasClear = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.el-dropdown-menu__item'));
        return items.some(i => i.textContent.includes('清除'));
      });
      if (!hasClear) throw new Error('dropdown 菜单中无"清除已保存凭据"项');
      console.log('  断言通过: 凭据 Dialog "更多"菜单包含"清除已保存凭据"项');

      const r = await shot(page, '11-server-credential-more.png', '服务器凭据 Dialog 更多菜单');
      results.push({ ...r, ok: true, verified: 'el-dialog, el-dialog__footer dropdown含"清除"项' });
    }

    // --- 12. 点击"清除已保存凭据" → MessageBox 确认框 ---
    console.log('\n[12] 清除已保存凭据 MessageBox 确认框');
    {
      await clickDropdownItem(page, '清除');
      await page.waitForTimeout(1000);

      // ElMessageBox 确认框
      await assertExists(page, '.el-message-box', 'MessageBox 确认框已出现');

      // 断言确认框浮在 Dialog 上方（z-index 检查）
      // z-index 在 .el-overlay 祖先元素上，不在 .el-message-box 或 .el-dialog 本身上
      // 页面上可能有多个 .el-dialog（编辑 Dialog 也在 DOM 中），需找可见的那个
      const zIndexOk = await page.evaluate(() => {
        // 找可见的 MessageBox
        const msgBoxes = Array.from(document.querySelectorAll('.el-message-box'));
        const msgBox = msgBoxes.find(m => m.offsetHeight > 0);
        if (!msgBox) return { ok: false, reason: 'no visible messagebox' };

        // 找可见的 Dialog
        const dialogs = Array.from(document.querySelectorAll('.el-dialog'));
        const dialog = dialogs.find(d => d.offsetHeight > 0);
        if (!dialog) return { ok: false, reason: 'no visible dialog' };

        // 向上查找 .el-overlay 祖先（z-index 设在此元素上）
        function getOverlayZ(el) {
          const overlay = el.closest('.el-overlay');
          if (overlay) {
            const z = window.getComputedStyle(overlay).zIndex;
            if (z && z !== 'auto') return parseInt(z);
          }
          // 回退：遍历祖先找有 z-index 的元素
          let cur = el;
          while (cur && cur !== document.body) {
            const z = window.getComputedStyle(cur).zIndex;
            if (z && z !== 'auto') return parseInt(z);
            cur = cur.parentElement;
          }
          return 0;
        }

        const msgZ = getOverlayZ(msgBox);
        const dlgZ = getOverlayZ(dialog);
        return { ok: msgZ > dlgZ, msgZ, dlgZ };
      });
      if (!zIndexOk.ok) {
        const detail = JSON.stringify(zIndexOk);
        throw new Error(`MessageBox z-index 未高于 Dialog（层级错误）: ${detail}`);
      }
      console.log(`  断言通过: MessageBox 层级高于 Dialog (msg=${zIndexOk.msgZ} > dlg=${zIndexOk.dlgZ})`);

      // 断言 MessageBox 包含"清除"和"取消"按钮
      const msgText = await page.evaluate(() => {
        const box = document.querySelector('.el-message-box');
        return box ? box.textContent : '';
      });
      if (!msgText.includes('清除')) throw new Error('MessageBox 文本不包含"清除"');
      console.log('  断言通过: MessageBox 文本包含"清除"');

      const r = await shot(page, '12-server-clear-confirm.png', '清除已保存凭据 MessageBox 确认框');
      results.push({ ...r, ok: true, verified: 'el-message-box可见, z-index>dialog, 含"清除"文本' });

      // 取消确认，不实际清除
      await page.evaluate(() => {
        const cancelBtn = Array.from(document.querySelectorAll('.el-message-box__btns button')).find(b => b.textContent.includes('取消'));
        if (cancelBtn) cancelBtn.click();
      });
      await page.waitForTimeout(500);
      console.log('  已取消清除（不实际清除任何凭据）');
    }

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
