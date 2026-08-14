/**
 * 电子秤字段补充：数据准备脚本
 * 为现有电子秤记录补充 scaleNo 和 ipAddress，确保截图数据干净（无 null/undefined/123/e2e 脏值）
 * RS232/USB 非联网电子秤 ipAddress 留空（截图显示 —）
 */
const BASE = 'http://localhost:3999'

async function login() {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: '123456' }),
  })
  const data = await resp.json()
  if (!data.token) throw new Error('Login failed: ' + JSON.stringify(data))
  return data.token
}

async function updateScale(token, id, payload) {
  const resp = await fetch(`${BASE}/api/scales/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Update scale ${id} failed: ${resp.status} ${JSON.stringify(data)}`)
  return data
}

async function main() {
  const token = await login()
  console.log('登录成功')

  // 获取现有电子秤列表
  const resp = await fetch(`${BASE}/api/scales?page=1&pageSize=100`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const list = await resp.json()
  console.log(`现有电子秤 ${list.total} 条`)

  // 为每条记录补充 scaleNo 和 ipAddress
  // RS232/USB 非联网电子秤 ipAddress 留空（截图显示 —）
  const updates = [
    { id: 1, scaleNo: '01', ipAddress: null },        // RS232 非联网
    { id: 2, scaleNo: '02', ipAddress: null },        // USB 非联网
    { id: 3, scaleNo: '生鲜03', ipAddress: '192.168.1.53' }, // 联网电子秤
  ]

  for (const u of updates) {
    // 先获取当前记录的完整数据
    const detailResp = await fetch(`${BASE}/api/scales?page=1&pageSize=100`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    const detail = await detailResp.json()
    const row = detail.list.find(r => r.id === u.id)
    if (!row) { console.log(`  跳过 id=${u.id}：不存在`); continue }

    const payload = {
      storeId: row.storeId,
      assetNo: row.assetNo,
      brand: row.brand,
      model: row.model,
      serialNo: row.serialNo,
      scaleNo: u.scaleNo,
      ipAddress: u.ipAddress,
      capacityKg: row.capacityKg,
      precisionG: row.precisionG,
      interface: row.interface,
      lastCalibrationDate: row.lastCalibrationDate,
      nextCalibrationDate: row.nextCalibrationDate,
      calibrationCycleDays: row.calibrationCycleDays,
      installLocation: row.installLocation,
      status: row.status,
      remark: row.remark,
    }

    await updateScale(token, u.id, payload)
    console.log(`  更新 id=${u.id}: scaleNo=${u.scaleNo}, ipAddress=${u.ipAddress || '(空)'}`)
  }

  // 验证更新结果
  const verifyResp = await fetch(`${BASE}/api/scales?page=1&pageSize=100`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  const verified = await verifyResp.json()
  console.log('\n验证结果:')
  for (const r of verified.list) {
    console.log(`  id=${r.id} storeId=${r.storeId} scaleNo=${r.scaleNo || '(空)'} ipAddress=${r.ipAddress || '(空)'} brand=${r.brand} status=${r.status}`)
  }

  // 数据质量断言：截图数据不能出现 null/undefined/123/e2e 等脏测试值
  for (const r of verified.list) {
    if (r.scaleNo === '123' || r.scaleNo === 'e2e' || r.scaleNo === 'undefined') {
      throw new Error(`数据质量断言失败: id=${r.id} scaleNo=${r.scaleNo} 含脏测试值`)
    }
    if (r.ipAddress === '123' || r.ipAddress === 'e2e' || r.ipAddress === 'undefined') {
      throw new Error(`数据质量断言失败: id=${r.id} ipAddress=${r.ipAddress} 含脏测试值`)
    }
  }
  console.log('\n数据质量断言通过: 无脏测试值')
}

main().catch(e => { console.error(e); process.exit(1) })
