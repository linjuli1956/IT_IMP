/**
 * 网络设备拓扑 Tab 截图：it/network-devices（拓扑 Tab）
 * 双视口：1366×768 与 1440×1024
 * 截图矩阵：管理员正常拓扑 / 无连线空态 / 门店筛选 / 节点抽屉 / 查看者
 * Playwright headless，Mock API 响应（无需数据库）
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://127.0.0.1:3000';
const SHOT_DIR = path.join(__dirname, '..', '..', 'screenshots', 'network-topology-tab');

if (!fs.existsSync(SHOT_DIR)) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
}

const viewports = [
  { width: 1366, height: 768, label: '1366' },
  { width: 1440, height: 1024, label: '1440' },
];

// —— Mock 门店 ——
const mockStores = [
  { id: 1, name: '总部', code: 'HQ', sort: 1, status: 1 },
  { id: 2, name: '泰兴店', code: 'TX', sort: 2, status: 1 },
  { id: 3, name: '黄桥店', code: 'HQ2', sort: 3, status: 1 },
];

// —— Mock 拓扑数据（正常：有连线） ——
const mockTopology = {
  devices: [
    { id: 1, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: '华为', model: 'S5735', serialNo: 'SN2024HW001', managementIp: '192.168.1.2', macAddress: 'A4-B1-C2-D3-E4-F5', portCount: 24, uplinkPort: 'Gig1/0/1', firmwareVersion: 'V200R019', installLocation: '一楼弱电井', status: '正常', remark: '核心交换机', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: 'H3C', model: 'S1820', serialNo: 'SN2024H3C002', managementIp: '192.168.1.3', macAddress: 'B5-C2-D3-E4-F5-A6', portCount: 8, uplinkPort: 'Gig0/1', firmwareVersion: 'V5', installLocation: '二楼弱电井', status: '正常', remark: '接入交换机', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 3, storeId: 1, storeName: '总部', deviceType: '路由器', manageType: '网管型', brand: '华为', model: 'AR2220', serialNo: 'SN2024HW003', managementIp: '192.168.1.1', macAddress: 'C6-D3-E4-F5-A6-B7', portCount: 4, uplinkPort: 'GE0/0/1', firmwareVersion: 'V200R010', installLocation: '机房', status: '正常', remark: '出口路由', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 4, storeId: 1, storeName: '总部', deviceType: '防火墙', manageType: '网管型', brand: '深信服', model: 'AF-2000', serialNo: 'SN2024SF004', managementIp: '192.168.1.254', macAddress: 'D7-E4-F5-A6-B7-C8', portCount: 8, uplinkPort: 'GE0', firmwareVersion: 'V8.0', installLocation: '机房入口', status: '正常', remark: '边界防火墙', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 5, storeId: 1, storeName: '总部', deviceType: 'AP', manageType: '非网管', brand: 'TP-LINK', model: 'TL-AP', serialNo: 'SN2024TP005', managementIp: null, macAddress: 'E8-F5-A6-B7-C8-D9', portCount: 1, uplinkPort: null, firmwareVersion: null, installLocation: '卖场', status: '正常', remark: '无线AP', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 6, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '网管型', brand: '锐捷', model: 'S2900', serialNo: 'SN2023RG006', managementIp: '192.168.1.4', macAddress: 'F9-A6-B7-C8-D9-E0', portCount: 24, uplinkPort: 'Gig0/1', firmwareVersion: 'V12', installLocation: '仓库', status: '停用', remark: '已替换待回收', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 7, storeId: 1, storeName: '总部', deviceType: '交换机', manageType: '非网管', brand: 'TP-LINK', model: 'TL-SF', serialNo: 'SN2022TP007', managementIp: null, macAddress: null, portCount: 5, uplinkPort: null, firmwareVersion: null, installLocation: '库房', status: '报废', remark: '已报废', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 8, storeId: 2, storeName: '泰兴店', deviceType: '交换机', manageType: '网管型', brand: 'H3C', model: 'S5120', serialNo: 'SN2025H3C008', managementIp: '192.168.2.2', macAddress: 'A1-B2-C3-D4-E5-F6', portCount: 24, uplinkPort: 'Gig0/1', firmwareVersion: 'V7', installLocation: '一楼弱电井', status: '正常', remark: '门店核心', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    { id: 9, storeId: 2, storeName: '泰兴店', deviceType: 'AP', manageType: '非网管', brand: 'TP-LINK', model: 'TL-AP2', serialNo: 'SN2025TP009', managementIp: null, macAddress: 'B2-C3-D4-E5-F6-A7', portCount: 1, uplinkPort: null, firmwareVersion: null, installLocation: '卖场入口', status: '正常', remark: '门店无线', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  ],
  links: [
    { id: 1, sourceDeviceId: 1, sourcePort: 'Gig1/0/24', targetDeviceId: 2, targetPort: 'Gig0/1', linkType: '上联', remark: '核心→接入' },
    { id: 2, sourceDeviceId: 1, sourcePort: 'Gig1/0/1', targetDeviceId: 3, targetPort: 'GE0/0/1', linkType: '直连', remark: '核心→路由器' },
    { id: 3, sourceDeviceId: 3, sourcePort: 'GE0/0/2', targetDeviceId: 4, targetPort: 'GE0', linkType: '直连', remark: '路由器→防火墙' },
    { id: 4, sourceDeviceId: 1, sourcePort: 'Gig1/0/23', targetDeviceId: 5, targetPort: '', linkType: '直连', remark: '核心→AP' },
    { id: 5, sourceDeviceId: 8, sourcePort: 'Gig0/1', targetDeviceId: 9, targetPort: '', linkType: '直连', remark: '门店核心→AP' },
  ],
};

// —— Mock 拓扑数据（空态：无连线） ——
const mockTopologyEmpty = {
  devices: mockTopology.devices,
  links: [],
};

// —— Mock 台账列表（分页） ——
const mockDeviceList = {
  list: mockTopology.devices.slice(0, 5).map(d => ({
    ...d,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  })),
  total: mockTopology.devices.length,
  page: 1,
  pageSize: 20,
};

async function login(page, role, options = {}) {
  // catch-all
  await page.route(`${BASE}/api/**`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  // 特定 API
  await page.route(`${BASE}/api/stores`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockStores) })
  );
  await page.route(`${BASE}/api/settings`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );
  await page.route(`${BASE}/api/network-devices`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDeviceList) })
  );

  // 拓扑 API：根据 options.error 决定返回 500，或 options.empty 返回空态，否则返回正常
  if (options.error) {
    await page.route(`${BASE}/api/network-devices/topology**`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) })
    );
  } else {
    const topoData = options.empty ? mockTopologyEmpty : mockTopology;
    await page.route(`${BASE}/api/network-devices/topology**`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(topoData) })
    );
  }

  // POST/DELETE 连线 API mock
  await page.route(`${BASE}/api/network-devices/links`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );
  await page.route(`${BASE}/api/network-devices/links/*`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
  );

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const name = role === '管理员' ? '管理员' : role === '操作员' ? '操作员' : '查看者';
  await page.evaluate(({ r, n }) => {
    localStorage.setItem('token', 'network-topo-mock-token');
    localStorage.setItem('user_info', JSON.stringify({ id: 1, username: 'admin', name: n, role: r, status: '正常' }));
  }, { r: role, n: name });
  console.log(`  注入 mock token + API 路由拦截（角色：${role}${options.empty ? '，空态' : ''}）`);
}

async function shot(page, name, label) {
  console.log(`  ${label}...`);
  await page.waitForTimeout(2000);
  const hasKey = await page.evaluate(() => {
    return !!(
      document.querySelector('.topology-chart') ||
      document.querySelector('.empty-state') ||
      document.querySelector('.chart-error') ||
      document.querySelector('.chart-empty-filtered') ||
      document.querySelector('.el-drawer') ||
      document.querySelector('.el-tabs')
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
    // ===== 1. 管理员正常拓扑 =====
    await login(page, '管理员');
    await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    // 切换到拓扑 Tab
    await page.locator('.el-tabs__item:has-text("网络拓扑")').click();
    await page.waitForTimeout(3000); // 等待 ECharts 渲染
    await step(results, `topo-${vp.label}-admin-normal.png`, `[${vp.label}] 管理员正常拓扑`,
      () => shot(page, `topo-${vp.label}-admin-normal.png`, `[${vp.label}] 管理员正常拓扑`));

    // ===== 2. 门店筛选（选择泰兴店） =====
    await step(results, `topo-${vp.label}-store-filter.png`, `[${vp.label}] 门店筛选态（泰兴店）`, async () => {
      const storeSelect = page.locator('.topology-card').locator('..').locator('.el-select').first();
      await storeSelect.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(300);
      await page.locator('.el-select-dropdown__item:has-text("泰兴店")').click().catch(() => {});
      await page.waitForTimeout(2000);
      return shot(page, `topo-${vp.label}-store-filter.png`, `[${vp.label}] 门店筛选态`);
    });

    // ===== 2.5 类型筛选空态（有连线但筛选后无完整连线） =====
    await step(results, `topo-${vp.label}-type-filter-empty.png`, `[${vp.label}] 类型筛选空态`, async () => {
      // 重新加载页面获取干净状态（无门店筛选）
      await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.locator('.el-tabs__item:has-text("网络拓扑")').click();
      await page.waitForTimeout(3000);
      // 通过 placeholder 定位设备类型 select
      const typeInput = page.locator('input[placeholder="设备类型"]');
      await typeInput.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(800);
      // 点击下拉中的 AP 选项
      const apOption = page.locator('.el-select-dropdown__item').filter({ hasText: 'AP' }).last();
      await apOption.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(2000);
      // DOM 断言：应显示“当前筛选条件下暂无完整连线”
      const emptyFilteredText = await page.locator('text=当前筛选条件下暂无完整连线').isVisible().catch(() => false);
      console.log(`  [DOM断言] 类型筛选空态文案存在: ${emptyFilteredText} (期望 true)`);
      if (!emptyFilteredText) {
        results.push({ name: `_dom-assert-type-filter-empty-${vp.label}.txt`, ok: false, reason: '未看到类型筛选空态文案' });
      }
      // DOM 断言：清空筛选按钮存在
      const clearFilterBtn = await page.locator('button:has-text("清空设备类型筛选")').isVisible().catch(() => false);
      console.log(`  [DOM断言] 清空筛选按钮存在: ${clearFilterBtn} (期望 true)`);
      return shot(page, `topo-${vp.label}-type-filter-empty.png`, `[${vp.label}] 类型筛选空态`);
    });

    // ===== 3. 节点抽屉（点击节点打开详情） =====
    await step(results, `topo-${vp.label}-node-drawer.png`, `[${vp.label}] 节点详情抽屉`, async () => {
      // 尝试多个位置点击 ECharts canvas 以命中节点
      const chartCanvas = page.locator('.topology-chart canvas').first();
      if (await chartCanvas.isVisible().catch(() => false)) {
        const box = await chartCanvas.boundingBox();
        if (box) {
          // 力导向图通常将节点分布在中心附近，尝试多个坐标
          const positions = [
            [0.5, 0.45], [0.5, 0.4], [0.45, 0.5], [0.55, 0.5],
            [0.4, 0.4], [0.6, 0.4], [0.4, 0.5], [0.6, 0.5],
            [0.5, 0.5], [0.35, 0.35], [0.65, 0.55], [0.5, 0.35],
          ];
          for (const [px, py] of positions) {
            await page.mouse.click(box.x + box.width * px, box.y + box.height * py);
            await page.waitForTimeout(800);
            const drawerOpen = await page.locator('.el-drawer').isVisible().catch(() => false);
            if (drawerOpen) break;
          }
        }
      }
      return shot(page, `topo-${vp.label}-node-drawer.png`, `[${vp.label}] 节点详情抽屉`);
    });

    // DOM 断言：管理员抽屉内有"新增连线"按钮
    const addLinkBtn = page.locator('.el-drawer button:has-text("新增连线")');
    const hasAddLink = await addLinkBtn.isVisible().catch(() => false);
    console.log(`  [DOM断言] 管理员新增连线按钮存在: ${hasAddLink} (期望 true)`);
    if (!hasAddLink) {
      results.push({ name: `_dom-assert-admin-${vp.label}.txt`, ok: false, reason: '管理员未看到新增连线按钮' });
    }
    await closeDrawer(page);

    // ===== 4. 无连线空态 =====
    await step(results, `topo-${vp.label}-empty.png`, `[${vp.label}] 无连线空态`, async () => {
      await ctx.clearCookies();
      await login(page, '管理员', { empty: true });
      await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.locator('.el-tabs__item:has-text("网络拓扑")').click();
      await page.waitForTimeout(2000);
      return shot(page, `topo-${vp.label}-empty.png`, `[${vp.label}] 无连线空态`);
    });

    // ===== 5. API 500 错误态 =====
    await step(results, `topo-${vp.label}-api-error.png`, `[${vp.label}] API 500 错误态`, async () => {
      await ctx.clearCookies();
      await login(page, '管理员', { error: true });
      await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.locator('.el-tabs__item:has-text("网络拓扑")').click();
      await page.waitForTimeout(3000);
      // DOM 断言：应显示“拓扑数据加载失败”
      const errorText = await page.locator('text=拓扑数据加载失败').isVisible().catch(() => false);
      console.log(`  [DOM断言] 错误态文案存在: ${errorText} (期望 true)`);
      if (!errorText) {
        results.push({ name: `_dom-assert-api-error-${vp.label}.txt`, ok: false, reason: '未看到错误态文案' });
      }
      // DOM 断言：重试按钮存在
      const retryBtn = await page.locator('button:has-text("重试")').isVisible().catch(() => false);
      console.log(`  [DOM断言] 重试按钮存在: ${retryBtn} (期望 true)`);
      return shot(page, `topo-${vp.label}-api-error.png`, `[${vp.label}] API 500 错误态`);
    });

    // ===== 6. 查看者拓扑（无新增/删除连线入口） =====
    await step(results, `topo-${vp.label}-viewer.png`, `[${vp.label}] 查看者拓扑（无编辑入口）`, async () => {
      await ctx.clearCookies();
      await login(page, '查看者');
      await page.goto(`${BASE}/it/network-devices`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      await page.locator('.el-tabs__item:has-text("网络拓扑")').click();
      await page.waitForTimeout(3000);
      return shot(page, `topo-${vp.label}-viewer.png`, `[${vp.label}] 查看者拓扑`);
    });

    // 打开查看者节点抽屉，验证无编辑入口
    await step(results, `topo-${vp.label}-viewer-drawer.png`, `[${vp.label}] 查看者节点抽屉`, async () => {
      const viewerChartCanvas = page.locator('.topology-chart canvas').first();
      if (await viewerChartCanvas.isVisible().catch(() => false)) {
        const vbox = await viewerChartCanvas.boundingBox();
        if (vbox) {
          const positions = [
            [0.5, 0.45], [0.5, 0.4], [0.45, 0.5], [0.55, 0.5],
            [0.4, 0.4], [0.6, 0.4], [0.4, 0.5], [0.6, 0.5],
            [0.5, 0.5], [0.35, 0.35], [0.65, 0.55], [0.5, 0.35],
          ];
          for (const [px, py] of positions) {
            await page.mouse.click(vbox.x + vbox.width * px, vbox.y + vbox.height * py);
            await page.waitForTimeout(800);
            const drawerOpen = await page.locator('.el-drawer').isVisible().catch(() => false);
            if (drawerOpen) break;
          }
        }
      }
      // DOM 断言：查看者抽屉内不应有新增连线/删除按钮
      const drawerAddLink = page.locator('.el-drawer button:has-text("新增连线")');
      const drawerHasAddLink = await drawerAddLink.isVisible().catch(() => false);
      console.log(`  [DOM断言] 查看者抽屉内新增连线按钮存在: ${drawerHasAddLink} (期望 false)`);
      if (drawerHasAddLink) {
        results.push({ name: `topo-${vp.label}-viewer-drawer.png`, ok: false, reason: '查看者抽屉内看到了新增连线按钮' });
      }
      const drawerDelLink = page.locator('.el-drawer button:has-text("删除")');
      const drawerHasDelLink = await drawerDelLink.isVisible().catch(() => false);
      console.log(`  [DOM断言] 查看者抽屉内删除连线按钮存在: ${drawerHasDelLink} (期望 false)`);
      if (drawerHasDelLink) {
        results.push({ name: `topo-${vp.label}-viewer-drawer.png`, ok: false, reason: '查看者抽屉内看到了删除连线按钮' });
      }
      return shot(page, `topo-${vp.label}-viewer-drawer.png`, `[${vp.label}] 查看者节点抽屉`);
    });

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

  console.log('\n=== 网络拓扑 Tab 截图汇总 ===');
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
