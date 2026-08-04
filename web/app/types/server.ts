/** 服务器管理类型定义（本地服务器 + 阿里云/腾讯云/华为云/自定义） */

export interface ServerItem {
  id: number
  name: string              // 服务器名称（如"财务数据库服务器"）
  serverType: string        // 服务器类型：本地/阿里云/腾讯云/华为云/自定义
  cloudAccount: string      // 云账号（如阿里云账号、腾讯云账号，本地服务器可留空）
  internalIp: string        // 内网IP（如 192.168.0.100）
  externalIp: string        // 外网IP（公网IP，本地服务器可留空）
  port: string              // 连接端口（如SSH默认22）
  cpuModel: string          // CPU型号（如 Intel Xeon E5-2680 v4）
  cpuCores: string          // CPU核数（如 4核）
  memorySize: string        // 内存大小（如 16GB）
  systemDiskSize: string    // 系统盘大小（如 50GB）
  dataDiskSize: string      // 数据盘大小（如 500GB）
  diskType: string          // 硬盘类型：SSD/HDD/SSD+HDD
  os: string                // 操作系统（如 CentOS 7.9 / Windows Server 2019）
  purpose: string           // 用途
  account: string           // 登录账号
  password: string          // 登录密码（敏感）
  dbAccount: string         // 数据库账号（敏感）
  dbPassword: string        // 数据库密码（敏感）
  dbPort: string            // 数据库端口（如 3306）
  expireDate: string        // 到期日期（云服务器续费日期，格式 YYYY-MM-DD，本地服务器可留空）
  remark: string            // 备注
  status: string            // 正常/停用
}
