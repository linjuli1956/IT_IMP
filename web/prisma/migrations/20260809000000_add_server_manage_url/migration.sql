-- 服务器管理地址字段（可空；用于"前往管理"新窗口打开）
ALTER TABLE `servers` ADD COLUMN `manageUrl` VARCHAR(500) NULL COMMENT '管理地址（如 PVE/ESXi 管理界面 URL，可空；前往管理时新窗口打开）' AFTER `remark`;
