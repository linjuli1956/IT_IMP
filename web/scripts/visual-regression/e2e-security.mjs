/**
 * E2E 测试脚本共享安全护栏
 *
 * 所有写操作 E2E 脚本必须通过此模块获取配置。
 * 缺任一环境变量立即退出，不提供硬编码回退。
 *
 * 必需环境变量：
 * - BASE_URL            目标地址（仅允许 localhost / 127.0.0.1）
 * - LOGIN_USER          测试账号
 * - LOGIN_PASS          测试密码
 * - CONFIRM_E2E_FIXTURE_WRITE=YES  显式确认执行写操作
 */

/** E2E 测试数据名称前缀 */
export const E2E_PREFIX = '__e2e_server__'

/**
 * 校验并返回 E2E 环境配置。
 * 缺任一变量或非 localhost 立即 process.exit(1)。
 */
export function requireE2EEnv() {
  const BASE_URL = process.env.BASE_URL
  if (!BASE_URL) {
    console.error('安全中止：请设置环境变量 BASE_URL')
    console.error('  用法：$env:BASE_URL="http://localhost:3999"; node xxx.mjs')
    process.exit(1)
  }

  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    console.error(`安全中止：BASE_URL (${BASE_URL}) 不是 localhost，拒绝执行`)
    process.exit(1)
  }

  const LOGIN_USER = process.env.LOGIN_USER
  const LOGIN_PASS = process.env.LOGIN_PASS
  if (!LOGIN_USER || !LOGIN_PASS) {
    console.error('安全中止：请设置环境变量 LOGIN_USER 和 LOGIN_PASS（不硬编码凭据）')
    console.error('  用法：$env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."; node xxx.mjs')
    process.exit(1)
  }

  if (process.env.CONFIRM_E2E_FIXTURE_WRITE !== 'YES') {
    console.error('安全中止：请设置 CONFIRM_E2E_FIXTURE_WRITE=YES 确认执行写操作')
    console.error('  此脚本将修改测试数据，请确认目标环境为测试库。')
    console.error('  用法：$env:CONFIRM_E2E_FIXTURE_WRITE="YES"; node xxx.mjs')
    process.exit(1)
  }

  return { BASE_URL, LOGIN_USER, LOGIN_PASS }
}

/**
 * 登录并返回带 Authorization 的 headers。
 * 登录失败立即退出。
 */
export async function e2eLogin(BASE_URL, LOGIN_USER, LOGIN_PASS) {
  const resp = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: LOGIN_USER, password: LOGIN_PASS }),
  })
  if (!resp.ok) {
    console.error(`登录失败：HTTP ${resp.status} ${resp.statusText}`)
    process.exit(1)
  }
  const { token } = await resp.json()
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
}

/**
 * 封装 fetch + response.ok 检查。
 * 任何非 2xx 响应抛出 Error（含 method/path/status/body）。
 */
export async function e2eFetch(BASE_URL, path, options, headers) {
  const method = options?.method || 'GET'
  const resp = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`${method} ${path} → HTTP ${resp.status}: ${body}`)
  }
  return resp
}

/**
 * 只读脚本（截图等）的安全检查。
 * 不要求 CONFIRM_E2E_FIXTURE_WRITE，但仍禁止硬编码凭据。
 */
export function requireE2EReadonly() {
  const BASE_URL = process.env.BASE_URL || 'http://localhost:3999'

  if (!BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1')) {
    console.error(`安全中止：BASE_URL (${BASE_URL}) 不是 localhost，拒绝执行`)
    process.exit(1)
  }

  const LOGIN_USER = process.env.LOGIN_USER
  const LOGIN_PASS = process.env.LOGIN_PASS
  if (!LOGIN_USER || !LOGIN_PASS) {
    console.error('安全中止：请设置环境变量 LOGIN_USER 和 LOGIN_PASS（不硬编码凭据）')
    console.error('  用法：$env:LOGIN_USER="admin"; $env:LOGIN_PASS="..."; node xxx.mjs')
    process.exit(1)
  }

  return { BASE_URL, LOGIN_USER, LOGIN_PASS }
}

/**
 * 查询所有 __e2e_server__ 前缀的测试数据。
 * 返回 { list, total }。
 */
export async function findE2eServers(BASE_URL, headers) {
  const resp = await e2eFetch(
    BASE_URL,
    `/api/servers?keyword=${encodeURIComponent(E2E_PREFIX)}&pageSize=100`,
    {},
    headers,
  )
  return await resp.json()
}
