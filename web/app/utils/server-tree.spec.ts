/**
 * 服务器树形组树 单元测试
 */
import { describe, it, expect } from 'vitest'
import { buildServerTree } from './server-tree'
import type { ServerListItem } from '~/types/server'

function makeServer(
  partial: Partial<Omit<ServerListItem, 'id' | 'name' | 'isVirtual'>> & { id: number; name: string; isVirtual: boolean },
): ServerListItem {
  return {
    serverType: '本地',
    status: '正常',
    hypervisor: null,
    hostServerId: null,
    hostServerName: null,
    vmCount: 0,
    ...partial,
  } as ServerListItem
}

describe('buildServerTree', () => {
  it('物理机在前并携带其下虚拟机', () => {
    const host = makeServer({ id: 1, name: '宿主机A', isVirtual: false, vmCount: 2 })
    const vm1 = makeServer({ id: 2, name: 'VM-1', isVirtual: true, hostServerId: 1 })
    const vm2 = makeServer({ id: 3, name: 'VM-2', isVirtual: true, hostServerId: 1 })
    const tree = buildServerTree([vm1, host, vm2])
    expect(tree.length).toBe(1)
    expect(tree[0]!.id).toBe(1)
    expect(tree[0]!.children?.map(c => c.id)).toEqual([2, 3])
  })

  it('无宿主的孤儿虚拟机作为顶层行', () => {
    const host = makeServer({ id: 1, name: '宿主机A', isVirtual: false })
    const orphan = makeServer({ id: 5, name: '孤儿VM', isVirtual: true, hostServerId: null })
    const tree = buildServerTree([orphan, host])
    expect(tree.length).toBe(2)
    expect(tree[1]!.id).toBe(5)
    expect(tree[1]!.children).toBeUndefined()
  })

  it('筛选后宿主缺失的虚拟机按孤儿处理（不丢失行）', () => {
    // 虚拟机 hostServerId=1，但列表中没有 id=1 的物理机（被筛选掉）
    const vm = makeServer({ id: 2, name: 'VM-1', isVirtual: true, hostServerId: 1 })
    const tree = buildServerTree([vm])
    expect(tree.length).toBe(1)
    expect(tree[0]!.id).toBe(2)
  })

  it('空列表返回空数组', () => {
    expect(buildServerTree([])).toEqual([])
  })
})
