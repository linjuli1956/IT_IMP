-- 新增网络设备连接关系表 — 记录设备间的物理/逻辑连接（source=上游 → target=下游）
CREATE TABLE `network_device_links` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sourceDeviceId` INT NOT NULL COMMENT '源设备ID（上游设备，外键→network_devices.id，删除限制）',
  `sourcePort` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '源端口（如 GigabitEthernet1/0/1）',
  `targetDeviceId` INT NOT NULL COMMENT '目标设备ID（下游设备，外键→network_devices.id，删除限制）',
  `targetPort` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '目标端口',
  `linkType` VARCHAR(20) NOT NULL DEFAULT '直连' COMMENT '连接类型：上联/级联/直连/其他',
  `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='网络设备连接关系（source上游→target下游）';

-- 禁止同方向重复连接（sourceDeviceId + targetDeviceId + sourcePort + targetPort 唯一）
CREATE UNIQUE INDEX `network_device_links_unique_device_link_idx` ON `network_device_links`(`sourceDeviceId`, `targetDeviceId`, `sourcePort`, `targetPort`);

-- 查询索引
CREATE INDEX `network_device_links_sourceDeviceId_idx` ON `network_device_links`(`sourceDeviceId`);
CREATE INDEX `network_device_links_targetDeviceId_idx` ON `network_device_links`(`targetDeviceId`);

-- 源设备外键（删除被引用设备时受限，业务层先检查连线再删除设备，返回明确 409）
ALTER TABLE `network_device_links`
  ADD CONSTRAINT `network_device_links_sourceDeviceId_fkey`
  FOREIGN KEY (`sourceDeviceId`) REFERENCES `network_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 目标设备外键（删除被引用设备时受限，同上）
ALTER TABLE `network_device_links`
  ADD CONSTRAINT `network_device_links_targetDeviceId_fkey`
  FOREIGN KEY (`targetDeviceId`) REFERENCES `network_devices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
