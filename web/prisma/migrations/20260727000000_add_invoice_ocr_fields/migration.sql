-- 新增发票OCR识别相关字段
ALTER TABLE `invoices`
  ADD COLUMN `invoiceNumber` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '发票号码（独立列，便于查询统计）',
  ADD COLUMN `invoiceDate` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '开票日期，格式YYYY-MM-DD',
  ADD COLUMN `sellerName` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '销售方名称';
