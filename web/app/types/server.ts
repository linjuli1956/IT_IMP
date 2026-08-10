/** 服务器管理类型定义（本地/云 + 物理机/虚拟机虚拟化） */

/** 服务器列表/详情项（**不含 password/dbPassword**，密码走独立接口） */
export interface ServerItem {
  id: number
  name: string              // 服务器名称
  serverType: string        // 服务器类型：本地/阿里云/腾讯云/华为云/自定义
  cloudAccount: string      // 云账号
  internalIp: string        // 内网IP
  externalIp: string        // 外网IP
  port: string              // 连接端口（默认22）
  cpuModel: string          // CPU型号
  cpuCores: string          // CPU核数（兼容存量字符串）
  memorySize: string        // 内存大小（兼容存量字符串）
  systemDiskSize: string    // 系统盘大小
  dataDiskSize: string      // 数据盘大小
  diskType: string          // 硬盘类型：SSD/HDD/SSD+HDD
  os: string                // 操作系统
  expireDate: string | null // 云服务器/租约到期日期 YYYY-MM-DD
  purpose: string           // 用途
  account: string           // 登录账号
  dbAccount: string         // 数据库账号
  dbPort: string            // 数据库端口
  remark: string            // 备注
  manageUrl: string | null  // 管理地址（PVE/ESXi/云控制台 URL，可空）
  status: string            // 正常 / 停用 / 报废
  manufacturer: string | null // 厂商
  model: string | null      // 服务器型号
  serialNo: string | null   // 序列号
  raidType: string | null   // RAID类型
  networkCards: string | null // 网卡信息
  warrantyEndDate: string | null // 硬件保修到期 YYYY-MM-DD
  isVirtual: boolean        // true=虚拟机，false=物理机
  hypervisor: string | null // 虚拟化平台：PVE / ESXi
  hostServerId: number | null // 宿主物理机ID
  cpuCoresAllocated: number | null // 虚拟机分配CPU核数
  memoryAllocatedGB: number | null // 虚拟机分配内存(GB)
  diskAllocatedGB: number | null // 虚拟机分配磁盘(GB)
  createdAt: string
  updatedAt: string
}

/** 列表响应（分页） */
export interface ServerListResponse {
  list: ServerListItem[]
  total: number
  page: number
  pageSize: number
}

/** 列表项附加字段（由后端 DTO 填充） */
export interface ServerListItem extends ServerItem {
  vmCount: number            // 物理机：该宿主下虚拟机数
  hostServerName: string | null // 虚拟机：宿主名称
  hostManageUrl: string | null  // 虚拟机：宿主的宿主机控制台管理地址（可空）
}

/** 详情页：宿主机下的虚拟机摘要 */
export interface ServerVirtualMachine {
  id: number
  name: string
  internalIp: string
  os: string
  purpose: string
  status: string
  hypervisor: string | null
  cpuCoresAllocated: number | null
  memoryAllocatedGB: number | null
  diskAllocatedGB: number | null
}

/** 详情页：虚拟机所属宿主摘要 */
export interface ServerHostInfo {
  id: number
  name: string
  internalIp: string
  isVirtual: boolean
  hypervisor: string | null
  os: string
  manageUrl: string | null
}

/** 服务器详情（物理机→含 virtualMachines；虚拟机→含 hostServer） */
export interface ServerDetail extends ServerItem {
  hostServer: ServerHostInfo | null
  virtualMachines: ServerVirtualMachine[]
}

/** 服务器列表查询条件（全部可选） */
export interface ServerQueryParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  isVirtual?: boolean
  hypervisor?: string
  hostServerId?: number
  serverType?: string
}
