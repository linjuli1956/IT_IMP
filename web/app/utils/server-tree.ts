/**
 * 服务器树形结构纯函数：物理机为父节点（children=其下虚拟机），孤儿虚拟机（无宿主）为顶层行。
 */
import type { ServerListItem } from '~/types/server'

export interface ServerTreeNode extends ServerListItem {
  children?: ServerTreeNode[]
}

/** 将平铺列表组装为树：物理机在前（含其下虚拟机），孤儿虚拟机（无宿主或宿主不在列表）追加到末尾 */
export function buildServerTree(list: ServerListItem[]): ServerTreeNode[] {
  const physicals = list.filter(s => !s.isVirtual)
  const virtuals = list.filter(s => s.isVirtual)
  const physicalIds = new Set(physicals.map(p => p.id))
  // 宿主不在列表（如筛选后）的虚拟机按孤儿处理，避免丢失行
  const orphans = virtuals.filter(v => v.hostServerId == null || !physicalIds.has(v.hostServerId))

  const nodes: ServerTreeNode[] = physicals.map(p => ({
    ...p,
    children: virtuals.filter(v => v.hostServerId === p.id),
  }))

  return [...nodes, ...orphans]
}
