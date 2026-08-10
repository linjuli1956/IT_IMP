-- 新增网络设备表 — 门店网络设备（网管交换机/企业级路由器/AP等）
CREATE TABLE `network_devices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `storeId` INT NOT NULL COMMENT '所属门店ID（外键→stores.id，删除受限）',
  `deviceType` VARCHAR(20) NOT NULL COMMENT '设备类型：交换机/路由器/AP/防火墙/其他',
  `manageType` VARCHAR(20) NULL COMMENT '管理类型：网管型/非网管',
  `brand` VARCHAR(50) NULL COMMENT '品牌（华为/H3C/锐捷/TP-LINK等）',
  `model` VARCHAR(100) NULL COMMENT '型号',
  `serialNo` VARCHAR(100) NULL COMMENT '序列号（可空唯一，空串提交转 NULL）',
  `managementIp` VARCHAR(50) NULL COMMENT '管理IP（可空唯一，空串提交转 NULL）',
  `macAddress` VARCHAR(50) NULL COMMENT 'MAC地址（可空唯一，空串提交转 NULL）',
  `portCount` INT NULL COMMENT '端口数',
  `uplinkPort` VARCHAR(50) NULL COMMENT '上联口（如 GigabitEthernet1/0/1）',
  `firmwareVersion` VARCHAR(50) NULL COMMENT '固件版本',
  `installLocation` VARCHAR(200) NULL COMMENT '安装位置（如 一楼弱电井）',
  `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用/报废',
  `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='门店网络设备（交换机/路由器/AP等）';

-- 唯一索引（索引名与 Prisma schema 默认一致；空值允许多条）
CREATE UNIQUE INDEX `network_devices_serialNo_key` ON `network_devices`(`serialNo`);
CREATE UNIQUE INDEX `network_devices_managementIp_key` ON `network_devices`(`managementIp`);
CREATE UNIQUE INDEX `network_devices_macAddress_key` ON `network_devices`(`macAddress`);

-- 查询索引
CREATE INDEX `network_devices_storeId_idx` ON `network_devices`(`storeId`);
CREATE INDEX `network_devices_deviceType_idx` ON `network_devices`(`deviceType`);
CREATE INDEX `network_devices_status_idx` ON `network_devices`(`status`);

-- 门店外键（删除被引用门店时受限，业务层转友好 409）
ALTER TABLE `network_devices`
  ADD CONSTRAINT `network_devices_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
