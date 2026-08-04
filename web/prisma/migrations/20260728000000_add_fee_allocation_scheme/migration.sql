-- 新增费用分摊方案表 — 通用费用分摊规则引擎
CREATE TABLE `fee_allocation_schemes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL COMMENT '方案名称，如"联通宽带套餐分摊"',
  `carrier` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '运营商（空字符串=通用，不绑定特定运营商）',
  `items` JSON NOT NULL DEFAULT (JSON_ARRAY()) COMMENT '费用项列表，JSON 存储 FeeItem[]',
  `reimbursementFormat` VARCHAR(50) NOT NULL DEFAULT '分摊明细型' COMMENT '报销说明格式',
  `reimbursementCustom` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '自定义报销说明',
  `status` INTEGER NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=禁用',
  `updateTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `fee_allocation_schemes_carrier_idx` ON `fee_allocation_schemes`(`carrier`);
CREATE INDEX `fee_allocation_schemes_status_idx` ON `fee_allocation_schemes`(`status`);
