/**
 * 网络拓扑演示数据创建脚本
 *
 * 创建 1 个演示门店 + 6 台演示设备 + 5 条连线，供本机验收完整拓扑效果。
 * 仅用于本次本机验收，不做系统默认 seed，不进入正式发布数据。
 *
 * 仅限用户明确授权的验收数据库执行，禁止对生产库运行。
 *
 * 用法：
 *   BASE_URL=http://127.0.0.1:3999 CONFIRM_TEST_DB=YES node scripts/demo-topology-data.cjs
 *
 * 必填环境变量：
 *   BASE_URL        — Nuxt 服务器地址（无默认值，必须显式传入）
 *   CONFIRM_TEST_DB — 必须为 YES 才允许执行写入操作
 *
 * 可选环境变量：
 *   ADMIN_TOKEN  — 管理员 JWT（优先使用；若不提供则用 admin/123456 登录）
 *
 * 验收完成后，运行 clean-topology-demo.cjs 清理演示数据。
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
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  });
  await assertOk(resp, '登录');
  return (await resp.json()).token;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * 回滚本轮已创建的 fixture（连线 → 设备 → 门店），失败必须报错，不得静默。
 */
async function rollbackCreated(headers, created) {
  const errors = [];

  // 1. 删除已创建的连线
  for (const id of created.linkIds) {
    try {
      const resp = await fetch(`${BASE_URL}/api/network-devices/links/${id}`, { method: 'DELETE', headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        errors.push(`回滚连线 ${id} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`回滚连线 ${id} 异常: ${e.message}`);
    }
  }

  // 2. 删除已创建的设备
  for (const id of created.deviceIds) {
    try {
      const resp = await fetch(`${BASE_URL}/api/network-devices/${id}`, { method: 'DELETE', headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        errors.push(`回滚设备 ${id} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`回滚设备 ${id} 异常: ${e.message}`);
    }
  }

  // 3. 删除已创建的门店
  if (created.storeId) {
    try {
      const resp = await fetch(`${BASE_URL}/api/stores/${created.storeId}`, { method: 'DELETE', headers });
      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        errors.push(`回滚门店 ${created.storeId} 失败: HTTP ${resp.status} ${body.slice(0, 100)}`);
      }
    } catch (e) {
      errors.push(`回滚门店 ${created.storeId} 异常: ${e.message}`);
    }
  }

  if (errors.length > 0) {
    console.error('\n⚠ 回滚过程中有失败项（不得静默跳过）:');
    errors.forEach(e => console.error(`  ${e}`));
    console.error('  请手动运行 clean-topology-demo.cjs 清理残留数据');
  } else {
    console.log('  回滚完成，无残留数据');
  }
}

async function main() {
  ADMIN_TOKEN = await getOrLogin();
  const headers = makeHeaders(ADMIN_TOKEN);

  const runId = `${DEMO_PREFIX}_${Date.now()}`;
  console.log(`\n=== 创建演示数据 ===`);
  console.log(`  runId: ${runId}`);

  // 基于 runId 派生唯一的 IP/MAC，保证每次运行唯一，不依赖人工先清理
  const ts = Date.now();
  const ipOctet2 = (ts % 200) + 10;                     // 10-209
  const ipOctet3 = (Math.floor(ts / 200) % 200) + 10;  // 10-209
  const tsHex = ts.toString(16).padStart(12, '0');

  function makeIP(i) { return `10.${ipOctet2}.${ipOctet3}.${i + 1}`; }
  function makeMAC(i) {
    const idx = (i + 1).toString(16).padStart(2, '0').toUpperCase();
    return `02:${tsHex.slice(0, 2).toUpperCase()}:${tsHex.slice(2, 4).toUpperCase()}:${tsHex.slice(4, 6).toUpperCase()}:${tsHex.slice(6, 8).toUpperCase()}:${idx}`;
  }

  // 跟踪已创建的 fixture，用于失败时回滚
  const created = { storeId: null, deviceIds: [], linkIds: [] };
  let success = false;

  try {
    // 1. 创建门店
    const storeResp = await fetch(`${BASE_URL}/api/stores`, {
      method: 'POST', headers,
      body: JSON.stringify({ name: `${runId}_store`, code: `DEMO${runId.slice(-6).toUpperCase()}`, sort: 999, status: 1 }),
    });
    await assertOk(storeResp, '创建门店');
    created.storeId = (await storeResp.json()).id;
    const storeId = created.storeId;
    console.log(`  门店 ID: ${storeId}`);

    // 2. 创建 6 台设备（IP/MAC 基于 runId 派生，保证唯一）
    const deviceSpecs = [
      { deviceType: '路由器', model: 'AR-6280', serialNo: `${runId}_SN_Router`, portCount: 8, status: '正常', remark: '出口路由器', installLocation: '机房' },
      { deviceType: '防火墙', model: 'USG-6000', serialNo: `${runId}_SN_FW`, portCount: 4, status: '正常', remark: '边界防火墙', installLocation: '机房' },
      { deviceType: '交换机', model: 'S5735-48C', serialNo: `${runId}_SN_Core`, portCount: 48, status: '正常', remark: '核心交换机', installLocation: '机房' },
      { deviceType: '交换机', model: 'S5700-28C', serialNo: `${runId}_SN_Access1`, portCount: 28, status: '正常', remark: '接入交换机-1F', installLocation: '一楼弱电井' },
      { deviceType: '交换机', model: 'S5700-28C', serialNo: `${runId}_SN_Access2`, portCount: 28, status: '正常', remark: '接入交换机-2F', installLocation: '二楼弱电井' },
      { deviceType: 'AP', model: 'AirEngine 5760', serialNo: `${runId}_SN_AP`, portCount: 1, status: '正常', remark: '一楼无线AP', installLocation: '一楼大厅' },
    ];

    const deviceIds = {};
    for (let i = 0; i < deviceSpecs.length; i++) {
      const spec = deviceSpecs[i];
      const resp = await fetch(`${BASE_URL}/api/network-devices`, {
        method: 'POST', headers,
        body: JSON.stringify({
          storeId, manageType: '网管型', brand: runId,
          managementIp: makeIP(i), macAddress: makeMAC(i),
          ...spec,
        }),
      });
      await assertOk(resp, `创建设备 ${spec.model}`);
      deviceIds[spec.remark] = (await resp.json()).id;
      created.deviceIds.push(deviceIds[spec.remark]);
      console.log(`  设备: ${spec.model} (${spec.remark}) → ID: ${deviceIds[spec.remark]}  IP: ${makeIP(i)}  MAC: ${makeMAC(i)}`);
      await sleep(100);
    }

    // 3. 创建 5 条连线（拓扑结构：防火墙→路由器→核心交换机→{接入1,接入2}, 接入1→AP）
    const linkSpecs = [
      { source: '边界防火墙', target: '出口路由器', sourcePort: 'Gig0/0/1', targetPort: 'Gig0/0/1', linkType: '上联', remark: `${runId} FW→Router` },
      { source: '出口路由器', target: '核心交换机', sourcePort: 'Gig0/0/2', targetPort: 'Gig0/0/1', linkType: '上联', remark: `${runId} Router→Core` },
      { source: '核心交换机', target: '接入交换机-1F', sourcePort: 'Gig0/0/24', targetPort: 'Gig0/0/1', linkType: '上联', remark: `${runId} Core→Access1` },
      { source: '核心交换机', target: '接入交换机-2F', sourcePort: 'Gig0/0/25', targetPort: 'Gig0/0/1', linkType: '上联', remark: `${runId} Core→Access2` },
      { source: '接入交换机-1F', target: '一楼无线AP', sourcePort: 'Gig0/0/24', targetPort: 'ETH1', linkType: '直连', remark: `${runId} Access1→AP` },
    ];

    console.log(`\n=== 创建连线 ===`);
    for (const spec of linkSpecs) {
      const resp = await fetch(`${BASE_URL}/api/network-devices/links`, {
        method: 'POST', headers,
        body: JSON.stringify({
          sourceDeviceId: deviceIds[spec.source],
          targetDeviceId: deviceIds[spec.target],
          sourcePort: spec.sourcePort,
          targetPort: spec.targetPort,
          linkType: spec.linkType,
          remark: spec.remark,
        }),
      });
      await assertOk(resp, `创建连线 ${spec.remark}`);
      const linkId = (await resp.json()).id;
      created.linkIds.push(linkId);
      console.log(`  连线: ${spec.source} → ${spec.target} (${spec.linkType})`);
      await sleep(100);
    }

    // 创建步骤全部完成，标记成功（后续拓扑查询为只读验证，失败不触发回滚）
    success = true;

    // 4. 查询拓扑验证
    console.log(`\n=== 验证拓扑 ===`);
    const topoResp = await fetch(`${BASE_URL}/api/network-devices/topology?storeId=${storeId}`, { headers });
    await assertOk(topoResp, '查询拓扑');
    const topoData = await topoResp.json();
    console.log(`  设备数: ${topoData.devices.length}`);
    console.log(`  连线数: ${topoData.links.length}`);
    console.log(`\n✓ 演示数据创建完成`);
    console.log(`  门店: ${created.storeId}`);
    console.log(`  设备: ${created.deviceIds.join(', ')}`);
    console.log(`\n  清理命令:`);
    console.log(`  BASE_URL=${BASE_URL} CONFIRM_TEST_DB=YES node scripts/clean-topology-demo.cjs`);
  } finally {
    if (!success) {
      console.error('\n⚠ 创建流程未完成，开始回滚已创建的 fixture...');
      await rollbackCreated(headers, created);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
