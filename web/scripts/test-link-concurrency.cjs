/**
 * 网络设备连接关系 — 反方向并发安全测试
 *
 * 验证目标（P1）：A→B 与 B→A 并发请求时，恰好一个成功（201/200）、一个被拒绝（409），
 * 最终数据库恰好一条连线。连续执行多轮。
 *
 * ⚠ 只能对独立测试库执行，禁止对生产库运行。
 *
 * 前置条件：
 *   1. 可用的 MySQL/MariaDB 测试库（非生产库），已执行 prisma migrate / db push
 *   2. Nuxt 服务器运行在 BASE_URL 指定地址
 *   3. 已有管理员账号（admin/123456 或通过 ADMIN_TOKEN 环境变量传入 JWT）
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:3000 CONFIRM_TEST_DB=YES node scripts/test-link-concurrency.cjs
 *
 * 环境变量（全部必填）：
 *   BASE_URL        — Nuxt 服务器地址（无默认值，必须显式传入）
 *   CONFIRM_TEST_DB — 必须为 YES 才允许执行写入操作
 *
 * 可选环境变量：
 *   ADMIN_TOKEN  — 管理员 JWT（优先使用；若不提供则用 admin/123456 登录）
 *   ROUNDS       — 连续执行轮数（默认 5）
 *
 * fixture 命名前缀：e2e_topology_*（所有门店/设备/连线均带此前缀，便于识别和清理）
 *
 * ──────────────────────────────────────────────────────
 * 状态：代码已修复、真实 MySQL 未验证
 * 原因：当前环境无可用 MySQL 测试库（.env 使用 PASSWORD_PLACEHOLDER 占位符），
 *       无法启动 Nuxt 服务器与真实数据库连接。
 *       本脚本已编写完成，待测试库就绪后可直接运行。
 *       真正跑出"多轮一成功一409、最终仅一条连线、cleanup 完成"的日志前，
 *       P1 状态仍是"代码已修复、真实 MySQL 未验证"。
 * ──────────────────────────────────────────────────────
 */

const PREFIX = 'e2e_topology';
const ROUNDS = parseInt(process.env.ROUNDS || '5', 10);

const BASE_URL = process.env.BASE_URL || '';
const CONFIRM = process.env.CONFIRM_TEST_DB || '';

// ── 环境守卫 ──
if (!BASE_URL) {
  console.error('错误：必须显式传入 BASE_URL 环境变量');
  console.error('用法：BASE_URL=http://127.0.0.1:3000 CONFIRM_TEST_DB=YES node scripts/test-link-concurrency.cjs');
  process.exit(1);
}
if (CONFIRM !== 'YES') {
  console.error('错误：CONFIRM_TEST_DB 必须为 YES 才允许执行写入操作');
  console.error('此脚本会对数据库创建和删除 fixture 数据，仅限独立测试库使用。');
  process.exit(1);
}

let ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

function makeHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };
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
  console.log('尝试登录获取 token (admin/123456)...');
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  await assertOk(resp, '登录');
  const data = await resp.json();
  if (!data.token) throw new Error('登录返回无 token');
  return data.token;
}

// ── fixture 清理（按 连线 → 设备 → 门店 顺序） ──
async function cleanup(headers, storeId, deviceAId, deviceBId) {
  const errors = [];

  // 1. 删除连线
  if (deviceAId || deviceBId) {
    try {
      const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology`, { headers });
      if (topoResp.ok) {
        const topoData = await topoResp.json();
        const links = (topoData.links || []).filter(l =>
          (l.sourceDeviceId === deviceAId && l.targetDeviceId === deviceBId) ||
          (l.sourceDeviceId === deviceBId && l.targetDeviceId === deviceAId)
        );
        for (const link of links) {
          const delResp = await fetch(`${BASE_URL}/api/network-devices/links/${link.id}`, { method: 'DELETE', headers });
          if (!delResp.ok) errors.push(`删除连线 ${link.id} 失败: HTTP ${delResp.status}`);
        }
      }
    } catch (e) {
      errors.push(`清理连线异常: ${e.message}`);
    }
  }

  // 2. 删除设备
  for (const devId of [deviceAId, deviceBId]) {
    if (!devId) continue;
    try {
      const delResp = await fetch(`${BASE_URL}/api/network-devices/${devId}`, { method: 'DELETE', headers });
      if (!delResp.ok) errors.push(`删除设备 ${devId} 失败: HTTP ${delResp.status}`);
    } catch (e) {
      errors.push(`清理设备 ${devId} 异常: ${e.message}`);
    }
  }

  // 3. 删除门店
  if (storeId) {
    try {
      const delResp = await fetch(`${BASE_URL}/api/stores/${storeId}`, { method: 'DELETE', headers });
      if (!delResp.ok) errors.push(`删除门店 ${storeId} 失败: HTTP ${delResp.status}`);
    } catch (e) {
      errors.push(`清理门店 ${storeId} 异常: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`清理失败（${errors.length} 项）:\n  ${errors.join('\n  ')}`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  ADMIN_TOKEN = await getOrLogin();
  const headers = makeHeaders(ADMIN_TOKEN);

  let storeId, deviceAId, deviceBId;

  try {
    // ── 准备 fixture ──
    console.log('\n=== 准备 fixture 数据 ===');

    // 创建门店
    const storeResp = await fetch(`${BASE_URL}/api/stores`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: `${PREFIX}_store`, code: 'E2E_TPO', sort: 999, status: 1 }),
    });
    await assertOk(storeResp, '创建门店');
    const storeData = await storeResp.json();
    storeId = storeData.id;
    console.log(`  门店 ID: ${storeId} (${PREFIX}_store)`);

    // 创建设备 A 和 B
    const deviceBase = { storeId, manageType: '网管型', status: '正常', portCount: 24 };
    const devAResp = await fetch(`${BASE_URL}/api/network-devices`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...deviceBase, deviceType: '交换机', brand: `${PREFIX}`, model: 'DEV-A', serialNo: `${PREFIX}_SN_A`, managementIp: '10.99.99.1', macAddress: 'AA:BB:CC:DD:EE:01' }),
    });
    await assertOk(devAResp, '创建设备 A');
    deviceAId = (await devAResp.json()).id;

    const devBResp = await fetch(`${BASE_URL}/api/network-devices`, {
      method: 'POST', headers,
      body: JSON.stringify({ ...deviceBase, deviceType: '路由器', brand: `${PREFIX}`, model: 'DEV-B', serialNo: `${PREFIX}_SN_B`, managementIp: '10.99.99.2', macAddress: 'AA:BB:CC:DD:EE:02' }),
    });
    await assertOk(devBResp, '创建设备 B');
    deviceBId = (await devBResp.json()).id;

    console.log(`  设备 A ID: ${deviceAId}`);
    console.log(`  设备 B ID: ${deviceBId}`);

    // 清理可能残留的连线
    await cleanup(headers, null, deviceAId, deviceBId);

    // ── 并发测试 ──
    let allPass = true;
    for (let round = 1; round <= ROUNDS; round++) {
      console.log(`\n=== 第 ${round} 轮并发测试 ===`);

      // 先清理上一轮的连线
      await cleanup(headers, null, deviceAId, deviceBId);
      await sleep(200);

      // 并发发起 A→B 和 B→A
      const linkAB = {
        sourceDeviceId: deviceAId, targetDeviceId: deviceBId,
        sourcePort: `Port-A-${round}`, targetPort: `Port-B-${round}`,
        linkType: '直连', remark: `${PREFIX} round${round}`,
      };
      const linkBA = {
        sourceDeviceId: deviceBId, targetDeviceId: deviceAId,
        sourcePort: `Port-B-${round}`, targetPort: `Port-A-${round}`,
        linkType: '直连', remark: `${PREFIX} round${round}`,
      };

      console.log('  并发发送 A→B 和 B→A...');
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
        console.log('  ✓ 恰好一个成功、一个 409');
      }

      // 查询数据库，验证恰好一条连线
      await sleep(200);
      const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology?storeId=${storeId}`, { headers });
      await assertOk(topoResp, '查询拓扑');
      const topoData = await topoResp.json();
      const links = (topoData.links || []).filter(l =>
        (l.sourceDeviceId === deviceAId && l.targetDeviceId === deviceBId) ||
        (l.sourceDeviceId === deviceBId && l.targetDeviceId === deviceAId)
      );

      if (links.length !== 1) {
        console.error(`  ✗ 断言失败：期望数据库恰好1条连线，实际 ${links.length} 条`);
        allPass = false;
      } else {
        console.log('  ✓ 数据库恰好1条连线');
      }
    }

    console.log('\n=== 并发测试结果 ===');
    if (allPass) {
      console.log(`✓ 全部 ${ROUNDS} 轮通过：反方向并发安全已验证`);
    } else {
      console.log(`✗ 存在失败轮次：反方向并发安全未完全通过`);
      process.exit(1);
    }
  } finally {
    // ── 完整清理 ──
    console.log('\n=== 清理 fixture 数据 ===');
    try {
      await cleanup(makeHeaders(ADMIN_TOKEN), storeId, deviceAId, deviceBId);
      console.log('  清理完成：连线 → 设备 → 门店');
    } catch (e) {
      console.error(`  清理失败！请手动检查 ${PREFIX}_* fixture:\n${e.message}`);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
