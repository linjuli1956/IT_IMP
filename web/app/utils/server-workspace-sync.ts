/**
 * 服务器工作区数据同步纯函数（可单测，不依赖 Vue/Nuxt 上下文）。
 */

/**
 * 检查 refreshWorkspace 的 Promise.allSettled 结果中是否有失败。
 *
 * - results[1]（tree）：rejected（当前 seq 的 fetchServerTree re-throw）或 treeError 有值
 * - results[0]（list）/ results[2]（stats）/ results[3]（hosts）：
 *   各自 fetch 内部 catch 不 re-throw，但设置对应 error 状态
 * - 注意：过期 tree 请求的失败被 shouldSilenceStaleFailure 静默丢弃，
 *   不会 rejected，不会设置 treeError
 */
export function hasRefreshFailure(
  results: PromiseSettledResult<unknown>[],
  errors: { treeError: string; listError: string; statsError: string; hostsError: string },
): boolean {
  const treeFailed = results[1]?.status === 'rejected' || Boolean(errors.treeError)
  const listFailed = Boolean(errors.listError)
  const statsFailed = Boolean(errors.statsError)
  const hostsFailed = Boolean(errors.hostsError)
  return treeFailed || listFailed || statsFailed || hostsFailed
}

/** activeTab → isVirtual 映射（全部=undefined / 物理=false / 虚拟=true） */
export function tabToIsVirtual(tab: 'all' | 'physical' | 'virtual'): boolean | undefined {
  if (tab === 'all') return undefined
  return tab === 'physical' ? false : true
}

/** 并发旧请求判断：mySeq !== currentSeq → 过期 */
export function isStaleRequest(mySeq: number, currentSeq: number): boolean {
  return mySeq !== currentSeq
}


/**
 * tree 请求失败时是否应静默丢弃（不写 error/loading/tree，不向调用方抛出）。
 *
 * 过期请求（mySeq !== currentSeq）失败时静默丢弃，
 * 只有当前 seq 的失败才传播给 refreshWorkspace。
 */
export function shouldSilenceStaleFailure(mySeq: number, currentSeq: number): boolean {
  return isStaleRequest(mySeq, currentSeq)
}
