/**
 * 重建 E2E 测试数据（幂等、可重复运行）
 *
 * 安全要求：
 * - 凭据通过环境变量注入，不硬编码
 * - 仅允许 localhost 目标
 * - 必须设置 CONFIRM_E2E_FIXTURE_WRITE=YES
 * - 所有测试数据名称以 __e2e_server__ 前缀标识
 * - 幂等：按名称查找，存在则 PUT 更新，不存在则 POST 创建
 * - 每个 API 调用均检查 response.ok
 *
 * 用法：
 *   $env:BASE_URL="http://localhost:3999"
 *   $env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."
 *   $env:CONFIRM_E2E_FIXTURE_WRITE="YES"
 *   node scripts/visual-regression/rebuild-test-data.mjs
 */
import { requireE2EEnv, e2eLogin, e2eFetch, E2E_PREFIX } from './e2e-security.mjs'

const { BASE_URL, LOGIN_USER, LOGIN_PASS } = requireE2EEnv()
const P = E2E_PREFIX

// 目标数据集（名称以 __e2e_server__ 前缀，便于识别和清理）
const TARGETS = [
  {
    name: `${P}pve_host`,
    isVirtual: false,
    fields: {
      name: `${P}pve_host`, serverType: '本地', isVirtual: false,
      hypervisor: 'PVE',
      internalIp: '10.10.10.10', externalIp: '', port: '22',
      cpuModel: 'Intel Xeon E5-2620 v4', cpuCores: '16核',
      memorySize: '64GB', systemDiskSize: '480GB', dataDiskSize: '4TB', diskType: 'SSD+HDD',
      os: 'Proxmox VE 8.1', purpose: 'E2E测试-PVE宿主',
      manufacturer: '测试', model: '测试', serialNo: 'E2E-PVE-001',
      raidType: 'RAID10', networkCards: '4×1G + 2×10G',
      manageUrl: 'https://10.10.10.10:8006', status: '正常',
      account: 'root', expireDate: null, warrantyEndDate: '2027-06-30',
    },
  },
  {
    name: `${P}pve_vm_mysql`,
    isVirtual: true,
    hostName: `${P}pve_host`,
    fields: {
      name: `${P}pve_vm_mysql`, serverType: '本地', isVirtual: true,
      hypervisor: 'PVE',
      internalIp: '10.10.10.11', externalIp: '', port: '22',
      cpuCoresAllocated: 8, memoryAllocatedGB: 16, diskAllocatedGB: 200,
      os: 'Ubuntu 22.04 LTS', purpose: 'E2E测试-MySQL主库',
      status: '正常', account: 'root',
    },
  },
  {
    name: `${P}pve_vm_redis`,
    isVirtual: true,
    hostName: `${P}pve_host`,
    fields: {
      name: `${P}pve_vm_redis`, serverType: '本地', isVirtual: true,
      hypervisor: 'PVE',
      internalIp: '10.10.10.12', externalIp: '', port: '22',
      cpuCoresAllocated: 4, memoryAllocatedGB: 8, diskAllocatedGB: 100,
      os: 'CentOS 7.9', purpose: 'E2E测试-Redis缓存',
      status: '正常', account: 'root',
    },
  },
  {
    name: `${P}pve_vm_nginx`,
    isVirtual: true,
    hostName: `${P}pve_host`,
    fields: {
      name: `${P}pve_vm_nginx`, serverType: '本地', isVirtual: true,
      hypervisor: 'PVE',
      internalIp: '10.10.10.13', externalIp: '', port: '22',
      cpuCoresAllocated: 2, memoryAllocatedGB: 4, diskAllocatedGB: 50,
      os: 'Debian 12', purpose: 'E2E测试-Nginx网关',
      status: '正常', account: 'root',
    },
  },
  {
    name: `${P}esxi_host`,
    isVirtual: false,
    fields: {
      name: `${P}esxi_host`, serverType: '本地', isVirtual: false,
      hypervisor: 'ESXi',
      internalIp: '10.10.10.20', externalIp: '', port: '22',
      cpuModel: 'Intel Xeon Silver 4210', cpuCores: '8核',
      memorySize: '32GB', systemDiskSize: '200GB', dataDiskSize: '1TB', diskType: 'SSD',
      os: 'VMware ESXi 7.0', purpose: 'E2E测试-ESXi宿主',
      manufacturer: '测试', model: '测试', serialNo: 'E2E-ESXi-001',
      raidType: 'RAID5', networkCards: '2×1G + 2×10G',
      manageUrl: 'https://10.10.10.20:8443', status: '正常',
      account: 'root', expireDate: null, warrantyEndDate: '2026-12-31',
    },
  },
  {
    name: `${P}esxi_vm_win`,
    isVirtual: true,
    hostName: `${P}esxi_host`,
    fields: {
      name: `${P}esxi_vm_win`, serverType: '本地', isVirtual: true,
      hypervisor: 'ESXi',
      internalIp: '10.10.10.31', externalIp: '', port: '3389',
      cpuCoresAllocated: 4, memoryAllocatedGB: 8, diskAllocatedGB: 500,
      os: 'Windows Server 2019', purpose: 'E2E测试-Windows文件服务',
      status: '正常', account: 'administrator',
    },
  },
]

async function main() {
  console.log('1. 登录...')
  const headers = await e2eLogin(BASE_URL, LOGIN_USER, LOGIN_PASS)

  // 先查询现有 E2E 数据，构建 name→id 映射
  console.log('2. 查询现有 E2E 测试数据...')
  const existing = {}
  for (const t of TARGETS) {
    const resp = await e2eFetch(
      BASE_URL,
      `/api/servers?keyword=${encodeURIComponent(t.name)}&pageSize=5`,
      {},
      headers,
    )
    const { list } = await resp.json()
    const found = list?.find(s => s.name === t.name)
    if (found) {
      existing[t.name] = found.id
      console.log(`   已存在: ${t.name} (id=${found.id})`)
    }
  }

  // 解析宿主 ID（VM 创建时需要 hostServerId）
  const nameToId = { ...existing }

  // 3. 幂等写入：先处理宿主，再处理 VM
  console.log('\n3. 写入测试数据（幂等）...')
  for (const target of TARGETS) {
    const fields = { ...target.fields }

    // 如果是 VM，设置 hostServerId
    if (target.isVirtual && target.hostName) {
      const hostId = nameToId[target.hostName]
      if (!hostId) {
        console.error(`   ✗ 宿主 ${target.hostName} 不存在，跳过 VM ${target.name}`)
        continue
      }
      fields.hostServerId = hostId
    }

    if (existing[target.name]) {
      // 已存在 → PUT 更新
      const id = existing[target.name]
      console.log(`   PUT 更新: ${target.name} (id=${id})`)
      await e2eFetch(BASE_URL, `/api/servers/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(fields),
      }, headers)
      console.log(`     ✓ 已更新`)
    } else {
      // 不存在 → POST 创建
      console.log(`   POST 创建: ${target.name}`)
      const resp = await e2eFetch(BASE_URL, '/api/servers', {
        method: 'POST',
        headers,
        body: JSON.stringify(fields),
      }, headers)
      const created = await resp.json()
      nameToId[target.name] = created.id
      console.log(`     ✓ 已创建 (id=${created.id})`)
    }
  }

  // 4. 验证
  console.log('\n4. 验证数据...')
  const resp = await e2eFetch(
    BASE_URL,
    `/api/servers?keyword=${encodeURIComponent(P)}&pageSize=100`,
    {},
    headers,
  )
  const { list, total } = await resp.json()
  console.log(`   E2E 测试数据: ${total} 条`)
  for (const s of list) {
    const tag = s.isVirtual ? 'VM' : '宿主'
    console.log(`   [${tag}] ${s.name} id=${s.id} IP:${s.internalIp} 平台:${s.hypervisor || '无'}`)
    if (!s.isVirtual && s.manageUrl) {
      console.log(`         管理地址: ${s.manageUrl}`)
    }
  }

  const hosts = list.filter(s => !s.isVirtual)
  const vms = list.filter(s => s.isVirtual)
  const pveHosts = hosts.filter(s => s.hypervisor === 'PVE')
  const esxiHosts = hosts.filter(s => s.hypervisor === 'ESXi')
  const pveVms = vms.filter(s => s.hypervisor === 'PVE')
  const esxiVms = vms.filter(s => s.hypervisor === 'ESXi')

  console.log(`\n   PVE 宿主: ${pveHosts.length} 台, PVE VM: ${pveVms.length} 台`)
  console.log(`   ESXi 宿主: ${esxiHosts.length} 台, ESXi VM: ${esxiVms.length} 台`)

  console.log('\n✅ E2E 测试数据重建完成（幂等）')
  console.log('   清理：node scripts/visual-regression/cleanup-test-data.mjs')
}

main().catch(e => {
  console.error('错误:', e.message || e)
  process.exit(1)
})
