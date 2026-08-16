/**
 * 停止服务结果消息协议（与 desktop/app.go 的 stopOutcomeMessage / decideStopFailure 一一对应）。
 * 抽成纯函数便于用 node:test 做可复现断言，App.vue 的停止/升级流程统一据此判定：
 *
 * - "停止失败: ..."            两级终止均失败，服务状态未知且保持运行中
 * - "...仍被其它/未知进程占用...未自动结束"  本应用进程已停，但端口归属不明（禁止继续升级等后续操作）
 * - "...服务已停止"            干净停止（含根进程自退且端口无占用）
 * - "服务未运行"               未启动过
 */

/** 两级终止均失败：状态未知且服务保持运行，不得改变 serviceRunning */
export const isStopFailed = (result) =>
  typeof result === 'string' && result.startsWith('停止失败')

/** 端口被其它/未知进程占用（未自动结束）：本应用进程已停，但端口状态不明 */
export const isPortOccupiedUnknown = (result) =>
  typeof result === 'string' && result.includes('占用') && result.includes('未自动结束')

/** 干净停止：非失败、非端口占用未知，且明确"已停止" */
export const isServiceStoppedClean = (result) =>
  typeof result === 'string' &&
  !isStopFailed(result) &&
  !isPortOccupiedUnknown(result) &&
  result.includes('已停止')
