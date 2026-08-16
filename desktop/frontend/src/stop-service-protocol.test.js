/**
 * 停止服务消息协议断言（node:test，零依赖，node --test 直接运行）。
 * 消息样例与 desktop/stop_service_test.go 中 Go 侧生成保持同构，
 * 用于锁定 handleStop / handleUpgradeDatabase 的判定契约。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isStopFailed, isPortOccupiedUnknown, isServiceStoppedClean } from './stop-service-protocol.js'

const CLEAN = '服务已停止'
const CLEAN_EXITED = 'Web服务进程已自行退出，服务已停止'
const OCCUPIED = '服务已停止，但端口 3999 仍被其它/未知进程占用(PID: 7777)，未自动结束；如非本应用遗留进程请忽略，否则请在任务管理器中手动结束'
const OCCUPIED_EXITED = 'Web服务进程已自行退出，服务已停止，但端口 3999 仍被其它/未知进程占用(PID: 7777)，未自动结束；如非本应用遗留进程请忽略，否则请在任务管理器中手动结束'
const FAILED = '停止失败: 无法终止本应用启动的 Web 服务进程(taskkill: 拒绝访问; Process.Kill: Access is denied)，服务状态未知且保持为运行中，请重试或手动处理'
const NOT_RUNNING = '服务未运行'

test('干净停止：仅 isServiceStoppedClean 为真', () => {
  assert.equal(isStopFailed(CLEAN), false)
  assert.equal(isPortOccupiedUnknown(CLEAN), false)
  assert.equal(isServiceStoppedClean(CLEAN), true)
  assert.equal(isServiceStoppedClean(CLEAN_EXITED), true)
})

test('P1-2 核心：端口未知占用时不得视为干净停止（升级流程必须中断）', () => {
  for (const msg of [OCCUPIED, OCCUPIED_EXITED]) {
    assert.equal(isPortOccupiedUnknown(msg), true, `应识别为端口占用未知: ${msg}`)
    assert.equal(isServiceStoppedClean(msg), false, `占用未知时不得判定为干净停止: ${msg}`)
    assert.equal(isStopFailed(msg), false)
  }
})

test('停止失败：仅 isStopFailed 为真，不得误报已停止', () => {
  assert.equal(isStopFailed(FAILED), true)
  assert.equal(isPortOccupiedUnknown(FAILED), false)
  assert.equal(isServiceStoppedClean(FAILED), false)
})

test('服务未运行与非字符串：全部为假', () => {
  for (const v of [NOT_RUNNING, '', null, undefined, { msg: CLEAN }]) {
    assert.equal(isStopFailed(v), false)
    assert.equal(isPortOccupiedUnknown(v), false)
    assert.equal(isServiceStoppedClean(v), false)
  }
})
