-- 新增明细表文件路径字段
ALTER TABLE `detail_tables`
  ADD COLUMN `filePath` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '原始XLS文件存储路径（相对 data/uploads/）';

-- 新增合同文件路径字段
ALTER TABLE `contracts`
  ADD COLUMN `filePath` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '合同PDF存储路径（相对 data/uploads/）';
