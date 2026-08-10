-- 服务器表改造：标准字段扩展 + 虚拟化自关联（物理机/虚拟机同表）
-- 目标：补厂商/型号/序列号/RAID/网卡/保修，支持 PVE/ESXi 宿主→虚拟机；日期转 DATE；序列号唯一

-- ⚠️ 迁移前人工预检（可选但强烈建议，执行迁移前先跑一次）：
-- 以下查询列出无法转换为 DATE 的 expireDate 记录（含空串占位与假日期），发现即先人工修复再迁移：
--   SELECT id, name, expireDate FROM servers
--   WHERE expireDate IS NOT NULL AND expireDate <> ''
--     AND (expireDate NOT REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
--          OR STR_TO_DATE(expireDate, '%Y-%m-%d') IS NULL);

-- 1. 仅将"空字符串占位"（明确非数据）转为 NULL；格式错误或假日期（如 2026-02-31）不自动改值，
--    由下方 ALTER 在 MySQL 严格模式下转换失败并中止迁移（不静默丢失原始数据，需人工修复后重跑）
UPDATE `servers` SET `expireDate` = NULL WHERE `expireDate` = '';

-- 2. expireDate 类型转换：VARCHAR(10) → DATE（列注释同步更新）
--    若存在无法转换的原始值，此处会报错并中止整份迁移
ALTER TABLE `servers`
  MODIFY COLUMN `expireDate` DATE NULL COMMENT '云服务器/租约到期日期（DATE）';

-- 3. 新增标准字段与虚拟化字段（含中文 COMMENT）
ALTER TABLE `servers`
  ADD COLUMN `manufacturer` VARCHAR(50) NULL COMMENT '厂商（戴尔/惠普/浪潮/华为/联想等）' AFTER `status`,
  ADD COLUMN `model` VARCHAR(100) NULL COMMENT '服务器型号' AFTER `manufacturer`,
  ADD COLUMN `serialNo` VARCHAR(100) NULL COMMENT '序列号（可空唯一）' AFTER `model`,
  ADD COLUMN `raidType` VARCHAR(50) NULL COMMENT 'RAID类型：RAID0/1/5/10/无' AFTER `serialNo`,
  ADD COLUMN `networkCards` VARCHAR(200) NULL COMMENT '网卡信息（如 2×1G + 2×10G）' AFTER `raidType`,
  ADD COLUMN `warrantyEndDate` DATE NULL COMMENT '硬件保修到期日期（DATE）' AFTER `networkCards`,
  ADD COLUMN `isVirtual` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否虚拟机（0=物理机，1=虚拟机）' AFTER `warrantyEndDate`,
  ADD COLUMN `hypervisor` VARCHAR(20) NULL COMMENT '虚拟化平台：PVE / ESXi / 空' AFTER `isVirtual`,
  ADD COLUMN `hostServerId` INT NULL COMMENT '宿主物理机ID（自关联，物理机为空，虚拟机必填）' AFTER `hypervisor`,
  ADD COLUMN `cpuCoresAllocated` INT NULL COMMENT '虚拟机分配CPU核数（非负）' AFTER `hostServerId`,
  ADD COLUMN `memoryAllocatedGB` DECIMAL(8,2) NULL COMMENT '虚拟机分配内存（GB，非负）' AFTER `cpuCoresAllocated`,
  ADD COLUMN `diskAllocatedGB` DECIMAL(10,2) NULL COMMENT '虚拟机分配磁盘（GB，非负）' AFTER `memoryAllocatedGB`,
  ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间' AFTER `diskAllocatedGB`,
  ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间' AFTER `createdAt`;

-- 4. 清洗 serialNo：空字符串转 NULL（建唯一索引前，避免空串冲突）
UPDATE `servers` SET `serialNo` = NULL WHERE `serialNo` = '';

-- 5. 序列号唯一索引（索引名与 Prisma schema 默认一致）
CREATE UNIQUE INDEX `servers_serialNo_key` ON `servers`(`serialNo`);

-- 6. 保修到期 / 宿主机 查询索引
CREATE INDEX `servers_warrantyEndDate_idx` ON `servers`(`warrantyEndDate`);
CREATE INDEX `servers_hostServerId_idx` ON `servers`(`hostServerId`);

-- 7. 宿主机自关联外键（ON DELETE RESTRICT：禁止级联删除虚拟机；索引名与 Prisma 默认一致）
ALTER TABLE `servers`
  ADD CONSTRAINT `servers_hostServerId_fkey`
  FOREIGN KEY (`hostServerId`) REFERENCES `servers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
