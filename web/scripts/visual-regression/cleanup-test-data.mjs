/**
 * 清理 E2E 测试数据
 *
 * 删除所有 __e2e_server__ 前缀的服务器记录。
 * 先删 VM（isVirtual=true），再删宿主（isVirtual=false）。
 *
 * 安全要求与 rebuild-test-data.mjs 一致：
 * - 凭据环境变量注入
 * - localhost 护栏
 * - CONFIRM_E2E_FIXTURE_WRITE=YES
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3999"
 *   $env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."
 *   $env:CONFIRM_E2E_FIXTURE_WRITE="YES"
 *   node scripts/visual-regression/cleanup-test-data.mjs
 */
import { requireE2EEnv, e2eLogin, e2eFetch, E2E_PREFIX } from './e2e-security.mjs'

const { BASE_URL, LOGIN_USER, LOGIN_PASS } = requireE2EEnv()

async function main() {
  console.log('1. 登录...')
  const headers = await e2eLogin(BASE_URL, LOGIN_USER, LOGIN_PASS)

  console.log('2. 查询 E2E 测试数据...')
  const resp = await e2eFetch(
    BASE_URL,
    `/api/servers?keyword=${encodeURIComponent(E2E_PREFIX)}&pageSize=100`,
    {},
    headers,
  )
  const { list, total } = await resp.json()

  if (total === 0) {
    console.log('   无 E2E 测试数据，无需清理')
    return
  }

  console.log(`   找到 ${total} 条 E2E 测试数据`)

  // 先删 VM，再删宿主（外键约束）
  const vms = list.filter(s => s.isVirtual)
  const hosts = list.filter(s => !s.isVirtual)

  console.log(`\n3. 删除 VM (${vms.length} 台)...`)
  for (const vm of vms) {
    console.log(`   DELETE ${vm.name} (id=${vm.id})`)
    await e2eFetch(BASE_URL, `/api/servers/${vm.id}`, {
      method: 'DELETE',
      headers,
    }, headers)
    console.log(`     ✓ 已删除`)
  }

  console.log(`\n4. 删除宿主 (${hosts.length} 台)...`)
  for (const host of hosts) {
    console.log(`   DELETE ${host.name} (id=${host.id})`)
    await e2eFetch(BASE_URL, `/api/servers/${host.id}`, {
      method: 'DELETE',
      headers,
    }, headers)
    console.log(`     ✓ 已删除`)
  }

  // 验证清理结果
  console.log('\n5. 验证清理结果...')
  const verifyResp = await e2eFetch(
    BASE_URL,
    `/api/servers?keyword=${encodeURIComponent(E2E_PREFIX)}&pageSize=100`,
    {},
    headers,
  )
  const { total: remaining } = await verifyResp.json()
  if (remaining > 0) {
    console.error(`   ⚠ 仍有 ${remaining} 条 E2E 数据未清理，请手动检查`)
    process.exit(1)
  }

  console.log('   ✓ E2E 测试数据已全部清除')
  console.log('\n✅ 清理完成')
}

main().catch(e => {
  console.error('错误:', e.message || e)
  process.exit(1)
})
