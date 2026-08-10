-- 新增电子称表 — 门店电子称（含校准信息）
CREATE TABLE `scales` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `storeId` INT NOT NULL COMMENT '所属门店ID（外键→stores.id，删除受限）',
  `assetNo` VARCHAR(50) NULL COMMENT '资产编号（可空唯一，空串提交转 NULL）',
  `brand` VARCHAR(50) NULL COMMENT '品牌（寺冈/顶尖/大华等）',
  `model` VARCHAR(100) NULL COMMENT '型号',
  `serialNo` VARCHAR(100) NULL COMMENT '序列号（可空唯一，空串提交转 NULL）',
  `capacityKg` DECIMAL(10,2) NULL COMMENT '量程（kg）',
  `precisionG` DECIMAL(8,2) NULL COMMENT '精度（g）',
  `interface` VARCHAR(20) NULL COMMENT '接口：RS232/USB/WiFi/蓝牙',
  `lastCalibrationDate` DATE NULL COMMENT '上次校准日期（DATE）',
  `nextCalibrationDate` DATE NULL COMMENT '下次校准日期（DATE，提醒依据）',
  `calibrationCycleDays` INT NULL COMMENT '校准周期（天）',
  `installLocation` VARCHAR(200) NULL COMMENT '安装位置（如 收银台3号）',
  `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用/报废',
  `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='门店电子称（含校准）';

-- 唯一索引（索引名与 Prisma schema 默认一致）
CREATE UNIQUE INDEX `scales_assetNo_key` ON `scales`(`assetNo`);
CREATE UNIQUE INDEX `scales_serialNo_key` ON `scales`(`serialNo`);

-- 查询索引
CREATE INDEX `scales_storeId_idx` ON `scales`(`storeId`);
CREATE INDEX `scales_status_idx` ON `scales`(`status`);

-- 门店外键（删除被引用门店时受限，业务层转友好 409）
ALTER TABLE `scales`
  ADD CONSTRAINT `scales_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
