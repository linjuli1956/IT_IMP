-- 新增电脑表 — 门店电脑（配置 + IP 信息）
CREATE TABLE `computers` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `storeId` INT NOT NULL COMMENT '所属门店ID（外键→stores.id，删除受限）',
  `assetNo` VARCHAR(50) NULL COMMENT '资产编号（可空唯一，空串提交转 NULL）',
  `department` VARCHAR(100) NULL COMMENT '所属部门',
  `brand` VARCHAR(50) NULL COMMENT '品牌（联想/戴尔/HP等）',
  `model` VARCHAR(100) NULL COMMENT '型号',
  `serialNo` VARCHAR(100) NULL COMMENT '序列号（可空唯一，空串提交转 NULL）',
  `user` VARCHAR(50) NULL COMMENT '使用人',
  `cpuModel` VARCHAR(100) NULL COMMENT 'CPU型号',
  `cpuCores` INT NULL COMMENT 'CPU核数',
  `memoryGB` INT NULL COMMENT '内存（GB）',
  `diskSizeGB` INT NULL COMMENT '硬盘容量（GB）',
  `diskType` VARCHAR(20) NULL COMMENT '硬盘类型：SSD/HDD/SSD+HDD',
  `ipAddress` VARCHAR(50) NULL COMMENT 'IP地址',
  `macAddress` VARCHAR(50) NULL COMMENT 'MAC地址（可空唯一，空串提交转 NULL）',
  `os` VARCHAR(50) NULL COMMENT '操作系统（Windows/Linux/macOS）',
  `osVersion` VARCHAR(50) NULL COMMENT '系统版本',
  `purchaseDate` DATE NULL COMMENT '采购日期（DATE）',
  `warrantyEndDate` DATE NULL COMMENT '保修到期（DATE）',
  `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用/报废',
  `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='门店电脑（配置+IP）';

-- 唯一索引（索引名与 Prisma schema 默认一致）
CREATE UNIQUE INDEX `computers_assetNo_key` ON `computers`(`assetNo`);
CREATE UNIQUE INDEX `computers_serialNo_key` ON `computers`(`serialNo`);
CREATE UNIQUE INDEX `computers_macAddress_key` ON `computers`(`macAddress`);

-- 查询索引
CREATE INDEX `computers_storeId_idx` ON `computers`(`storeId`);
CREATE INDEX `computers_status_idx` ON `computers`(`status`);

-- 门店外键（删除被引用门店时受限，业务层转友好 409）
ALTER TABLE `computers`
  ADD CONSTRAINT `computers_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
