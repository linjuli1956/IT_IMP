-- 清理预算明细历史重复数据：同一 财年+门店+运营商+费用类型 组合保留最小 id，删除其余重复行
-- 先清理再加唯一索引，避免建索引失败（不破坏已有数据）
DELETE b1 FROM `budget_details` b1
INNER JOIN `budget_details` b2
  ON b1.`fiscalYear` = b2.`fiscalYear`
 AND b1.`storeName` = b2.`storeName`
 AND b1.`carrier` = b2.`carrier`
 AND b1.`feeType` = b2.`feeType`
 AND b1.`id` > b2.`id`;

-- 新增组合唯一索引：财年+门店+运营商+费用类型（防止并发导入产生重复预算）
-- 索引名与 Prisma schema 生成的默认名一致，避免 migrate diff 漂移
CREATE UNIQUE INDEX `budget_details_fiscalYear_storeName_carrier_feeType_key`
  ON `budget_details`(`fiscalYear`, `storeName`, `carrier`, `feeType`);
