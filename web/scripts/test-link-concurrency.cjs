/**
 * 网络设备连接关系 — 反方向并发安全测试
 *
 * 验证目标（P1）：A→B 与 B→A 并发请求时，恰好一个成功（201/200）、一个被拒绝（409），
 * 最终数据库恰好一条连线。
 *
 * 前置条件：
 *   1. 可用的 MySQL/MariaDB 测试库（非生产库）
 *   2. 已执行 prisma migrate deploy（或 db push）创建表结构
 *   3. Nuxt 开发服务器运行在 BASE_URL（默认 http://127.0.0.1:3000）
 *   4. 已有管理员账号（通过环境变量 ADMIN_TOKEN 传入 JWT，或脚本自动登录）
 *
 * 用法：
 *   node scripts/test-link-concurrency.cjs
 *
 * 环境变量：
 *   BASE_URL      — Nuxt 服务器地址（默认 http://127.0.0.1:3000）
 *   ADMIN_TOKEN   — 管理员 JWT（若不提供，脚本尝试用 admin/admin123 登录）
 *   ROUNDS        — 连续执行轮数（默认 5）
 *
 * ──────────────────────────────────────────────────────
 * 状态：未验证
 * 原因：当前环境无可用 MySQL 测试库（.env 使用 PASSWORD_PLACEHOLDER 占位符），
 *       无法启动 Nuxt 服务器与真实数据库连接。
 *       本脚本已编写完成，待测试库就绪后可直接运行。
 * ──────────────────────────────────────────────────────
 */
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const ROUNDS = parseInt(process.env.ROUNDS || '5', 10);
let ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

async function main() {
  if (!ADMIN_TOKEN) {
    console.log('尝试登录获取 token...');
    try {
      const resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'admin123' }),
      });
      if (!resp.ok) throw new Error(`登录失败: ${resp.status}`);
      const data = await resp.json();
      ADMIN_TOKEN = data.token;
    } catch (e) {
      console.error('无法获取 token，请设置 ADMIN_TOKEN 环境变量');
      console.error('错误:', e.message);
      process.exit(1);
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
  };

  // 查找或创建测试门店 + 设备
  console.log('\n=== 准备测试数据 ===');
  let storeId, deviceA, deviceB;

  // 尝试查找已有测试门店
  const storesResp = await fetch(`${BASE_URL}/api/stores`, { headers });
  const stores = await storesResp.json();
  let testStore = (Array.isArray(stores) ? stores : stores.list || []).find(s => s.name === '并发测试门店');

  if (!testStore) {
    console.log('创建测试门店...');
    const resp = await fetch(`${BASE_URL}/api/stores`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: '并发测试门店', code: 'TEST_CC', sort: 999, status: 1 }),
    });
    if (!resp.ok) throw new Error(`创建门店失败: ${resp.status}`);
    testStore = await resp.json();
  }
  storeId = testStore.id;
  console.log(`  门店 ID: ${storeId}`);

  // 创建测试设备 A 和 B
  console.log('创建测试设备 A/B...');
  const deviceBase = { storeId, manageType: '网管型', status: '正常', portCount: 24 };
  const devAResp = await fetch(`${BASE_URL}/api/network-devices`, {
    method: 'POST', headers,
    body: JSON.stringify({ ...deviceBase, deviceType: '交换机', brand: '测试品牌A', model: 'TEST-A', serialNo: 'CONC-TEST-A', managementIp: '10.99.99.1', macAddress: 'AA:BB:CC:DD:EE:01' }),
  });
  if (devAResp.ok) {
    deviceA = await devAResp.json();
  } else {
    // 可能已存在，查询获取
    const listResp = await fetch(`${BASE_URL}/api/network-devices?storeId=${storeId}&keyword=CONC-TEST-A`, { headers });
    const listData = await listResp.json();
    deviceA = (listData.list || []).find(d => d.serialNo === 'CONC-TEST-A');
  }

  const devBResp = await fetch(`${BASE_URL}/api/network-devices`, {
    method: 'POST', headers,
    body: JSON.stringify({ ...deviceBase, deviceType: '路由器', brand: '测试品牌B', model: 'TEST-B', serialNo: 'CONC-TEST-B', managementIp: '10.99.99.2', macAddress: 'AA:BB:CC:DD:EE:02' }),
  });
  if (devBResp.ok) {
    deviceB = await devBResp.json();
  } else {
    const listResp = await fetch(`${BASE_URL}/api/network-devices?storeId=${storeId}&keyword=CONC-TEST-B`, { headers });
    const listData = await listResp.json();
    deviceB = (listData.list || []).find(d => d.serialNo === 'CONC-TEST-B');
  }

  if (!deviceA || !deviceB) {
    console.error('无法创建或获取测试设备');
    process.exit(1);
  }

  const aId = deviceA.id;
  const bId = deviceB.id;
  console.log(`  设备 A ID: ${aId}`);
  console.log(`  设备 B ID: ${bId}`);

  // 清理可能残留的连线
  await cleanupLinks(headers, aId, bId);

  // 执行多轮并发测试
  let allPass = true;
  for (let round = 1; round <= ROUNDS; round++) {
    console.log(`\n=== 第 ${round} 轮并发测试 ===`);

    // 先清理上一轮的连线
    await cleanupLinks(headers, aId, bId);
    await sleep(200); // 等待删除完成

    // 并发发起 A→B 和 B→A
    const linkAB = {
      sourceDeviceId: aId, targetDeviceId: bId,
      sourcePort: `Port-A-${round}`, targetPort: `Port-B-${round}`,
      linkType: '直连', remark: `并发测试第${round}轮`,
    };
    const linkBA = {
      sourceDeviceId: bId, targetDeviceId: aId,
      sourcePort: `Port-B-${round}`, targetPort: `Port-A-${round}`,
      linkType: '直连', remark: `并发测试第${round}轮`,
    };

    console.log(`  并发发送 A→B 和 B→A...`);
    const [resAB, resBA] = await Promise.all([
      fetch(`${BASE_URL}/api/network-devices/links`, { method: 'POST', headers, body: JSON.stringify(linkAB) }),
      fetch(`${BASE_URL}/api/network-devices/links`, { method: 'POST', headers, body: JSON.stringify(linkBA) }),
    ]);

    const statusAB = resAB.status;
    const statusBA = resBA.status;
    console.log(`  A→B 响应: ${statusAB}`);
    console.log(`  B→A 响应: ${statusBA}`);

    // 断言：恰好一个成功（200/201）、一个冲突（409）
    const oneSuccess = (statusAB === 200 || statusAB === 201) !== (statusBA === 200 || statusBA === 201);
    const oneConflict = statusAB === 409 || statusBA === 409;

    if (!oneSuccess || !oneConflict) {
      console.error(`  ✗ 断言失败：期望一个成功+一个409，实际 ${statusAB}+${statusBA}`);
      allPass = false;
    } else {
      console.log(`  ✓ 恰好一个成功、一个 409`);
    }

    // 查询数据库，验证恰好一条连线
    await sleep(200);
    const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology?storeId=${storeId}`, { headers });
    const topoData = await topoResp.json();
    const links = (topoData.links || []).filter(l =>
      (l.sourceDeviceId === aId && l.targetDeviceId === bId) ||
      (l.sourceDeviceId === bId && l.targetDeviceId === aId)
    );

    if (links.length !== 1) {
      console.error(`  ✗ 断言失败：期望数据库恰好1条连线，实际 ${links.length} 条`);
      allPass = false;
    } else {
      console.log(`  ✓ 数据库恰好1条连线`);
    }
  }

  // 清理测试数据
  console.log('\n=== 清理测试数据 ===');
  await cleanupLinks(headers, aId, bId);
  console.log('  连线已清理');

  console.log('\n=== 并发测试结果 ===');
  if (allPass) {
    console.log(`✓ 全部 ${ROUNDS} 轮通过：反方向并发安全已验证`);
  } else {
    console.log(`✗ 存在失败轮次：反方向并发安全未完全通过`);
    process.exit(1);
  }
}

async function cleanupLinks(headers, aId, bId) {
  try {
    const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology`, { headers });
    const topoData = await topoResp.json();
    const links = (topoData.links || []).filter(l =>
      (l.sourceDeviceId === aId && l.targetDeviceId === bId) ||
      (l.sourceDeviceId === bId && l.targetDeviceId === aId)
    );
    for (const link of links) {
      await fetch(`${BASE_URL}/api/network-devices/links/${link.id}`, { method: 'DELETE', headers });
    }
  } catch (e) {
    // 忽略清理错误
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
