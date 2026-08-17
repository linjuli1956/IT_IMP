/**
 * 网络拓扑演示数据清理脚本
 *
 * 删除所有 e2e_topology_demo 前缀的演示门店、设备、连线。
 * 严格按 连线 → 设备 → 门店 顺序删除，失败必须报错。
 *
 * 仅限用户明确授权的验收数据库执行，禁止对生产库运行。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:3999 CONFIRM_TEST_DB=YES node scripts/clean-topology-demo.cjs
 *
 * 必填环境变量：
 *   BASE_URL        — Nuxt 服务器地址（无默认值，必须显式传入）
 *   CONFIRM_TEST_DB — 必须为 YES 才允许执行写入操作
 *
 * 可选环境变量（三选一，均未提供时脚本直接报错退出，不内置任何默认凭据）：
 *   ADMIN_TOKEN — 管理员 JWT（优先使用）
 *   或显式提供 ADMIN_USERNAME / ADMIN_PASSWORD 登录获取
 */

const BASE_URL = process.env.BASE_URL || '';
const CONFIRM = process.env.CONFIRM_TEST_DB || '';

if (!BASE_URL) {
  console.error('错误：必须显式传入 BASE_URL 环境变量');
  process.exit(1);
}
if (CONFIRM !== 'YES') {
  console.error('错误：CONFIRM_TEST_DB 必须为 YES 才允许执行写入操作');
  process.exit(1);
}

const DEMO_PREFIX = 'e2e_topology_demo';
let ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function makeHeaders(token) {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}

async function assertOk(resp, label) {
  if (!resp.ok) {
    let body = '';
    try { body = await resp.text(); } catch { /* ignore */ }
    throw new Error(`${label} 失败: HTTP ${resp.status} ${body.slice(0, 200)}`);
  }
}

async function getOrLogin() {
  if (ADMIN_TOKEN) return ADMIN_TOKEN;
  const username = process.env.ADMIN_USERNAME || '';
  const password = process.env.ADMIN_PASSWORD || '';
  if (!username || !password) {
    throw new Error('缺少管理员凭据：请设置 ADMIN_TOKEN，或显式设置 ADMIN_USERNAME / ADMIN_PASSWORD');
  }
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  await assertOk(resp, '登录');
  return (await resp.json()).token;
}

async function main() {
  ADMIN_TOKEN = await getOrLogin();
  const headers = makeHeaders(ADMIN_TOKEN);

  console.log(`\n=== 清理演示数据 (${DEMO_PREFIX}) ===`);

  // 1. 查询拓扑，找出所有演示设备和连线
  const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology`, { headers });
  await assertOk(topoResp, '查询拓扑');
  const topoData = await topoResp.json();

  const demoDevices = topoData.devices.filter(d => d.brand?.startsWith(DEMO_PREFIX));
  const demoDeviceIds = new Set(demoDevices.map(d => d.id));
  const demoLinks = topoData.links.filter(l =>
    demoDeviceIds.has(l.sourceDeviceId) || demoDeviceIds.has(l.targetDeviceId) ||
    l.remark?.startsWith(DEMO_PREFIX)
  );

  // 2. 查询所有门店，找出演示门店（兼容 Store[] / { list } / { data } 三种返回格式）
  const storesResp = await fetch(`${BASE_URL}/api/stores`, { headers });
  await assertOk(storesResp, '查询门店');
  const storesData = await storesResp.json();
  const stores = Array.isArray(storesData) ? storesData : (storesData.list || storesData.data || []);
  const demoStores = stores.filter(s => s.name?.startsWith(DEMO_PREFIX));

  console.log(`  演示设备: ${demoDevices.length} 台`);
  console.log(`  演示连线: ${demoLinks.length} 条`);
  console.log(`  演示门店: ${demoStores.length} 个`);

  const errors = [];

  // 3. 删除连线
  console.log(`\n  [1/3] 删除连线...`);
  for (const link of demoLinks) {
    try {
      const resp = await fetch(`${BASE_URL}/api/network-devices/links/${link.id}`, { method: 'DELETE', headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        errors.push(`删除连线 ${link.id} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`删除连线 ${link.id} 异常: ${e.message}`);
    }
  }
  console.log(`    已处理 ${demoLinks.length} 条连线`);

  // 4. 删除设备
  console.log(`  [2/3] 删除设备...`);
  let deviceDeleted = 0;
  for (const device of demoDevices) {
    try {
      const resp = await fetch(`${BASE_URL}/api/network-devices/${device.id}`, { method: 'DELETE', headers });
      if (resp.ok) deviceDeleted++;
      else {
        const body = await resp.text().catch(() => '');
        errors.push(`删除设备 ${device.id} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`删除设备 ${device.id} 异常: ${e.message}`);
    }
  }
  console.log(`    已删除 ${deviceDeleted} 台设备`);

  // 5. 删除门店
  console.log(`  [3/3] 删除门店...`);
  let storeDeleted = 0;
  for (const store of demoStores) {
    try {
      const resp = await fetch(`${BASE_URL}/api/stores/${store.id}`, { method: 'DELETE', headers });
      if (resp.ok) storeDeleted++;
      else {
        const body = await resp.text().catch(() => '');
        errors.push(`删除门店 ${store.id} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`删除门店 ${store.id} 异常: ${e.message}`);
    }
  }
  console.log(`    已删除 ${storeDeleted} 个门店`);

  if (errors.length > 0) {
    console.error(`\n✗ 清理失败（${errors.length} 项）:`);
    errors.forEach(e => console.error(`  ${e}`));
    process.exit(1);
  }

  // 6. 清理后重新查询并断言 0 残留（只验证演示前缀，不触碰正常业务数据）
  console.log(`\n  [验证] 重新查询演示数据残留...`);
  const reTopoResp = await fetch(`${BASE_URL}/api/network-devices/topology`, { headers });
  await assertOk(reTopoResp, '复查拓扑');
  const reTopoData = await reTopoResp.json();
  const reDeviceIds = new Set(reTopoData.devices.filter(d => d.brand?.startsWith(DEMO_PREFIX)).map(d => d.id));
  const reLinks = reTopoData.links.filter(l =>
    reDeviceIds.has(l.sourceDeviceId) || reDeviceIds.has(l.targetDeviceId) ||
    l.remark?.startsWith(DEMO_PREFIX)
  );
  const reStoresResp = await fetch(`${BASE_URL}/api/stores`, { headers });
  await assertOk(reStoresResp, '复查门店');
  const reStoresData = await reStoresResp.json();
  const reStores = (Array.isArray(reStoresData) ? reStoresData : (reStoresData.list || reStoresData.data || []))
    .filter(s => s.name?.startsWith(DEMO_PREFIX));

  if (reDeviceIds.size > 0 || reLinks.length > 0 || reStores.length > 0) {
    console.error(`\n✗ 清理后仍有残留：门店 ${reStores.length} 个、设备 ${reDeviceIds.size} 台、连线 ${reLinks.length} 条`);
    process.exit(1);
  }
  console.log(`    残留 0 项 ✓`);

  console.log(`\n✓ 演示数据清理完成（含 0 残留断言）`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
