/**
 * 服务器虚拟化约束校验（服务层统一校验，创建/修改共用，可单元测试）
 *
 * 规则（对应需求文档 §4.2）：
 * 1. isVirtual=true 时 hostServerId 必填，且宿主必须存在；
 * 2. 宿主必须是物理机（isVirtual=false）；
 * 3. 不允许服务器指向自身；
 * 4. isVirtual=false 时 hostServerId 必须为空；
 * 5. 虚拟机分配值（CPU/内存/磁盘）必须为非负数。
 * 说明：宿主信息由调用方查询后传入（本函数不依赖 Prisma，保持纯函数可测）。
 */

/** 参与校验的服务器输入子集 */
export interface ServerVirtualizationInput {
  id?: number
  isVirtual?: boolean
  hostServerId?: number | null
  cpuCoresAllocated?: number | null
  memoryAllocatedGB?: number | null
  diskAllocatedGB?: number | null
}

/** 宿主记录的最小信息（由调用方查询传入） */
export interface HostServerInfo {
  id: number
  isVirtual: boolean
}

/** 校验结果 */
export interface ServerValidationResult {
  valid: boolean
  /** 错误消息（valid=false 时有效） */
  error?: string
  /** HTTP 状态码：400=约束违反，404=宿主不存在 */
  statusCode?: 400 | 404
}

/**
 * 校验服务器虚拟化约束。
 * @param input 待校验输入（id 用于排除"指向自身"）
 * @param hostServer 宿主记录；若 hostServerId 有值但宿主不存在，传 null
 */
export function validateServerVirtualization(
  input: ServerVirtualizationInput,
  hostServer: HostServerInfo | null,
): ServerValidationResult {
  const isVirtual = input.isVirtual ?? false
  const hostServerId = input.hostServerId ?? null

  // 规则 4：物理机不能有宿主
  if (!isVirtual && hostServerId != null) {
    return { valid: false, statusCode: 400, error: '物理机不能有宿主机（hostServerId 必须为空）' }
  }

  // 规则 1：虚拟机必须有宿主
  if (isVirtual && hostServerId == null) {
    return { valid: false, statusCode: 400, error: '虚拟机必须指定宿主机（hostServerId 必填）' }
  }

  // 规则 3：不能指向自身
  if (input.id != null && hostServerId === input.id) {
    return { valid: false, statusCode: 400, error: '不能将自己设为宿主机' }
  }

  // 规则 1：宿主必须存在
  if (isVirtual && hostServerId != null && !hostServer) {
    return { valid: false, statusCode: 404, error: '宿主机不存在' }
  }

  // 规则 2：宿主必须是物理机
  if (isVirtual && hostServerId != null && hostServer && hostServer.isVirtual) {
    return { valid: false, statusCode: 400, error: '宿主机必须是物理机（虚拟机不能作为其他虚拟机的宿主机）' }
  }

  // 规则 5：分配值非负
  const allocatedValues = [input.cpuCoresAllocated, input.memoryAllocatedGB, input.diskAllocatedGB]
  for (const value of allocatedValues) {
    if (value != null && value < 0) {
      return { valid: false, statusCode: 400, error: '虚拟机分配资源（CPU/内存/磁盘）不能为负数' }
    }
  }

  return { valid: true }
}
