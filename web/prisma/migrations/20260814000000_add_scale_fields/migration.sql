-- 电子秤字段补充：新增秤号和 IP 地址
ALTER TABLE `scales`
  ADD COLUMN `scaleNo` VARCHAR(50) NULL COMMENT '秤号（门店业务编号，如 01、生鲜03；同门店内唯一，不同门店可重复；NULL 不参与冲突）',
  ADD COLUMN `ipAddress` VARCHAR(45) NULL COMMENT 'IP地址（联网电子秤的 IPv4；RS232/USB 等非联网电子秤可不填）';

-- 同门店秤号唯一索引（NULL 不参与冲突，MySQL InnoDB 行为）
CREATE UNIQUE INDEX `scales_storeId_scaleNo_key` ON `scales`(`storeId`, `scaleNo`);
