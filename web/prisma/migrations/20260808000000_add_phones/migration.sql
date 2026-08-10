-- 新增固话表 — 门店/部门固话记录
CREATE TABLE `phones` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `storeId` INT NOT NULL COMMENT '所属门店ID（外键→stores.id，删除受限）',
  `department` VARCHAR(100) NULL COMMENT '所属部门（信息部/收银/生鲜等）',
  `phoneNumber` VARCHAR(30) NOT NULL COMMENT '固话号码（唯一，必填）',
  `extension` VARCHAR(20) NULL COMMENT '分机号',
  `carrier` VARCHAR(20) NULL COMMENT '运营商：电信/移动/联通/其他',
  `monthlyFee` DECIMAL(10,2) NULL COMMENT '月租（元）',
  `packageInfo` VARCHAR(200) NULL COMMENT '套餐说明',
  `user` VARCHAR(50) NULL COMMENT '使用人',
  `installLocation` VARCHAR(200) NULL COMMENT '安装位置',
  `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用/报废',
  `remark` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '备注',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '最后更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='门店/部门固话';

-- 唯一索引（索引名与 Prisma schema 默认一致）
CREATE UNIQUE INDEX `phones_phoneNumber_key` ON `phones`(`phoneNumber`);

-- 查询索引
CREATE INDEX `phones_storeId_idx` ON `phones`(`storeId`);
CREATE INDEX `phones_carrier_idx` ON `phones`(`carrier`);
CREATE INDEX `phones_status_idx` ON `phones`(`status`);

-- 门店外键（删除被引用门店时受限，业务层转友好 409）
ALTER TABLE `phones`
  ADD CONSTRAINT `phones_storeId_fkey`
  FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
