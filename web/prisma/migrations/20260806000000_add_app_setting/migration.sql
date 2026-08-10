-- 新增系统设置表 — 存储系统级 key-value 配置参数（如财年起始月），供各业务模块读取
CREATE TABLE `app_settings` (
  `key` VARCHAR(50) NOT NULL COMMENT '设置键名（主键），如 startMonth 表示财年起始月',
  `value` VARCHAR(255) NOT NULL COMMENT '设置值（字符串存储，按键名语义解析）',
  `description` VARCHAR(500) NULL COMMENT '设置说明（中文描述该参数的作用与取值范围）',
  `updatedAt` DATETIME(3) NOT NULL COMMENT '最后更新时间（自动维护）',
  PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 初始化默认设置：财年起始月为 4（现行财年规则：4月~次年3月为一个财年）
INSERT INTO `app_settings` (`key`, `value`, `description`, `updatedAt`) VALUES
  ('startMonth', '4', '财年起始月（1~12）：预算财年从该月算起，如 4 表示 4月~次年3月为一个财年', NOW(3));
