/**
 * useServerWorkspace 数据同步逻辑单元测试
 *
 * 覆盖：
 * - hasRefreshFailure：四种数据源（list/tree/stats/hosts）任一失败 → true
 * - tabToIsVirtual：activeTab → isVirtual 映射
 * - isStaleRequest：并发旧请求 requestSeq 比较逻辑
 *
 * 纯函数测试，不依赖 Vue/Nuxt 上下文，不加载 composable 模块。
 */
import { describe, it, expect } from 'vitest'
import {
  hasRefreshFailure,
  tabToIsVirtual,
  isStaleRequest,
  shouldSilenceStaleFailure,
} from '../utils/server-workspace-sync'
import type { ServerWorkspaceQuery } from './useServerWorkspace'

describe('hasRefreshFailure', () => {
  const noErrors = { treeError: '', listError: '', statsError: '', hostsError: '' }
  const allFulfilled: PromiseSettledResult<unknown>[] = [
    { status: 'fulfilled', value: null },
    { status: 'fulfilled', value: null },
    { status: 'fulfilled', value: null },
    { status: 'fulfilled', value: null },
  ]

  it('全部成功 → false', () => {
    expect(hasRefreshFailure(allFulfilled, noErrors)).toBe(false)
  })

  it('tree rejected → true', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: null },
      { status: 'rejected', reason: new Error('tree error') },
      { status: 'fulfilled', value: null },
      { status: 'fulfilled', value: null },
    ]
    expect(hasRefreshFailure(results, noErrors)).toBe(true)
  })

  it('listError 有值 → true（即使 Promise fulfilled）', () => {
    expect(hasRefreshFailure(allFulfilled, { ...noErrors, listError: '网络错误' })).toBe(true)
  })

  it('statsError 有值 → true', () => {
    expect(hasRefreshFailure(allFulfilled, { ...noErrors, statsError: 'stats error' })).toBe(true)
  })

  it('hostsError 有值 → true', () => {
    expect(hasRefreshFailure(allFulfilled, { ...noErrors, hostsError: 'hosts error' })).toBe(true)
  })

  it('treeError 有值 → true（即使 Promise fulfilled）', () => {
    expect(hasRefreshFailure(allFulfilled, { ...noErrors, treeError: 'tree error' })).toBe(true)
  })

  it('tree rejected + listError 同时 → true（不短路其他检查）', () => {
    const results: PromiseSettledResult<unknown>[] = [
      { status: 'fulfilled', value: null },
      { status: 'rejected', reason: new Error('tree') },
      { status: 'fulfilled', value: null },
      { status: 'fulfilled', value: null },
    ]
    expect(hasRefreshFailure(results, { ...noErrors, listError: 'list' })).toBe(true)
  })

  it('空字符串 error 视为无错误 → false', () => {
    expect(hasRefreshFailure(allFulfilled, {
      treeError: '', listError: '',
      statsError: '', hostsError: '',
    })).toBe(false)
  })

  it('results 为空数组 → false（无数据源失败）', () => {
    expect(hasRefreshFailure([], noErrors)).toBe(false)
  })
})

describe('tabToIsVirtual', () => {
  it('all → undefined（不传 isVirtual）', () => {
    expect(tabToIsVirtual('all')).toBeUndefined()
  })

  it('physical → false', () => {
    expect(tabToIsVirtual('physical')).toBe(false)
  })

  it('virtual → true', () => {
    expect(tabToIsVirtual('virtual')).toBe(true)
  })

  it('与 ServerWorkspaceQuery.activeTab 类型一致', () => {
    const tabs: ServerWorkspaceQuery['activeTab'][] = ['all', 'physical', 'virtual']
    expect(tabs.map(tabToIsVirtual)).toEqual([undefined, false, true])
  })
})

describe('isStaleRequest', () => {
  it('当前 seq = 请求 seq → 结果有效（false）', () => {
    expect(isStaleRequest(5, 5)).toBe(false)
  })

  it('当前 seq > 请求 seq → 结果过期（true）', () => {
    expect(isStaleRequest(3, 5)).toBe(true)
  })

  it('当前 seq < 请求 seq → 不可能但返回 true（安全丢弃）', () => {
    expect(isStaleRequest(5, 3)).toBe(true)
  })

  it('快速连续 3 次请求，只有最后一次结果有效', () => {
    let currentSeq = 0
    const requestSeqs: number[] = []
    for (let i = 1; i <= 3; i++) {
      requestSeqs.push(++currentSeq)
    }
    const finalSeq = currentSeq // 3
    // 第 1 次（seq=1）和第 2 次（seq=2）的结果已过期
    expect(isStaleRequest(requestSeqs[0]!, finalSeq)).toBe(true)
    expect(isStaleRequest(requestSeqs[1]!, finalSeq)).toBe(true)
    // 只有第 3 次（seq=3）的结果有效
    expect(isStaleRequest(requestSeqs[2]!, finalSeq)).toBe(false)
  })

  it('模拟异步：第 1 次请求结果在第 3 次请求后才返回 → 过期', () => {
    const seq1 = 1
    const seq2 = 2
    const seq3 = 3
    const finalSeq = 3
    expect(isStaleRequest(seq1, finalSeq)).toBe(true) // 第 1 次结果过期
    expect(isStaleRequest(seq2, finalSeq)).toBe(true) // 第 2 次结果过期
    expect(isStaleRequest(seq3, finalSeq)).toBe(false) // 第 3 次结果有效
  })
})

describe('shouldSilenceStaleFailure', () => {
  it('当前 seq 失败 → 不静默（需传播）', () => {
    expect(shouldSilenceStaleFailure(5, 5)).toBe(false)
  })

  it('过期 seq 失败 → 静默丢弃', () => {
    expect(shouldSilenceStaleFailure(3, 5)).toBe(true)
  })

  it('旧请求失败、新请求成功 → 旧请求被静默，不影响刷新结果', () => {
    // 模拟：旧请求(seq=1)先发起，新请求(seq=2)后发起
    const oldSeq = 1
    const newSeq = 2
    // 新请求成功完成后 treeSeq=2
    const treeSeqAfterNewSuccess = 2
    // 旧请求随后失败：seq(1) !== treeSeq(2) → 过期 → 静默
    expect(shouldSilenceStaleFailure(oldSeq, treeSeqAfterNewSuccess)).toBe(true)
    // 新请求成功时 seq(2) === treeSeq(2) → 不静默（正常路径，不进 catch）
    expect(shouldSilenceStaleFailure(newSeq, treeSeqAfterNewSuccess)).toBe(false)
  })

  it('当前请求失败 → 不静默，会设置 treeError 并 throw', () => {
    const currentSeq = 3
    const treeSeq = 3
    expect(shouldSilenceStaleFailure(currentSeq, treeSeq)).toBe(false)
  })

  it('多个过期请求失败 → 全部静默', () => {
    const treeSeq = 5
    expect(shouldSilenceStaleFailure(1, treeSeq)).toBe(true)
    expect(shouldSilenceStaleFailure(2, treeSeq)).toBe(true)
    expect(shouldSilenceStaleFailure(3, treeSeq)).toBe(true)
    expect(shouldSilenceStaleFailure(4, treeSeq)).toBe(true)
    expect(shouldSilenceStaleFailure(5, treeSeq)).toBe(false) // 当前
  })
})
