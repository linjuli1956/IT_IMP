-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '用户主键ID，自增',
    `username` VARCHAR(50) NOT NULL COMMENT '登录用户名，唯一',
    `passwordHash` VARCHAR(255) NOT NULL COMMENT '登录密码哈希值，不保存明文密码',
    `name` VARCHAR(50) NOT NULL COMMENT '用户姓名（显示名称）',
    `role` VARCHAR(20) NOT NULL DEFAULT '查看者' COMMENT '角色：管理员 / 操作员 / 查看者',
    `status` INTEGER NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=禁用',
    `lastLogin` DATETIME(0) NULL COMMENT '最后登录时间',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `updatedAt` DATETIME(0) NOT NULL COMMENT '最后更新时间',

    UNIQUE INDEX `users_username_key`(`username`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='系统用户表 — 存储登录账号和角色信息';

-- CreateTable
CREATE TABLE `operation_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '日志主键ID，自增',
    `user_id` INTEGER NULL COMMENT '操作用户ID，关联users表，可为空（用户删除后保留日志）',
    `username` VARCHAR(50) NOT NULL COMMENT '操作用户名（冗余存储，用户删除后仍可追溯）',
    `action` VARCHAR(20) NOT NULL COMMENT '操作类型：新增/编辑/删除/登录/登出/导出/打印/OCR导入/启动服务/停止服务/数据库初始化/数据库升级',
    `module` VARCHAR(50) NOT NULL COMMENT '操作模块：发票管理/计提管理/合同管理/预算管理/系统管理/基础配置/明细表管理/IT资产管理/支付管理',
    `content` TEXT NOT NULL COMMENT '操作内容详情',
    `ip` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '操作IP地址',
    `createdAt` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '操作时间',

    INDEX `operation_logs_user_id_idx`(`user_id`),
    INDEX `operation_logs_action_idx`(`action`),
    INDEX `operation_logs_module_idx`(`module`),
    INDEX `operation_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='操作日志表 — 记录用户所有操作行为，用于审计追踪';

-- CreateTable
CREATE TABLE `stores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '门店主键ID，自增',
    `name` VARCHAR(100) NOT NULL COMMENT '门店名称',
    `code` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '机构代码（支付配置关联用）',
    `sort` INTEGER NOT NULL DEFAULT 0 COMMENT '排序序号，越小越靠前',
    `status` INTEGER NOT NULL DEFAULT 1 COMMENT '状态：1=启用，0=禁用',

    INDEX `stores_status_idx`(`status`),
    INDEX `stores_sort_idx`(`sort`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='门店表 — 存储所有门店/机构信息，全局数据源';

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '供应商主键ID，自增',
    `name` VARCHAR(200) NOT NULL COMMENT '供应商名称',
    `contact` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '联系人',
    `phone` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '联系电话',
    `address` VARCHAR(500) NOT NULL DEFAULT '' COMMENT '地址',
    `type` VARCHAR(50) NOT NULL COMMENT '供应商类型：运营商/设备商/服务商/施工方(集成商)/软件供应商/其他',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',

    INDEX `suppliers_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='供应商表 — 存储运营商、设备商、服务商等供应商信息';

-- CreateTable
CREATE TABLE `accrual_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '模板主键ID，自增',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通',
    `store` VARCHAR(100) NOT NULL COMMENT '门店/机构名称',
    `itemCount` INTEGER NOT NULL DEFAULT 0 COMMENT '计提项目数量',
    `updateTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '最后更新时间',
    `reimbursementFormat` VARCHAR(50) NOT NULL DEFAULT '分摊明细型' COMMENT '报销说明格式：分摊明细型/费用明细型/汇总型/自定义',
    `reimbursementCustom` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '自定义报销说明格式（当reimbursementFormat为"自定义"时使用）',
    `items` JSON NOT NULL COMMENT '计提项目列表，JSON存储TemplateItem[]',

    INDEX `accrual_templates_carrier_idx`(`carrier`),
    INDEX `accrual_templates_store_idx`(`store`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='计提模板表 — 存储每个运营商+门店的计提项目模板，用于快速生成计提记录';

-- CreateTable
CREATE TABLE `invoice_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '批次主键ID，自增',
    `batchNo` VARCHAR(20) NOT NULL COMMENT '批次编号，唯一，格式如202606DX01（年月+运营商缩写+序号）',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通',
    `feeMonth` VARCHAR(10) NOT NULL COMMENT '费用月份，格式YYYY-MM',
    `store` VARCHAR(200) NOT NULL DEFAULT '' COMMENT '关联门店（顿号分隔多个门店）',
    `invoiceCount` INTEGER NOT NULL DEFAULT 0 COMMENT '发票数量',
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '发票总金额（价税合计）',
    `status` VARCHAR(20) NOT NULL DEFAULT 'pending' COMMENT '状态：pending待处理/accrued已计提/printed已打印',
    `createTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',

    UNIQUE INDEX `invoice_batches_batchNo_key`(`batchNo`),
    INDEX `invoice_batches_carrier_idx`(`carrier`),
    INDEX `invoice_batches_feeMonth_idx`(`feeMonth`),
    INDEX `invoice_batches_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='发票批次表 — 按运营商+费用月份分组管理发票';

-- CreateTable
CREATE TABLE `invoices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '发票主键ID，自增',
    `batch_id` INTEGER NULL COMMENT '所属批次ID，关联invoice_batches表',
    `name` VARCHAR(255) NOT NULL COMMENT '发票文件名',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通',
    `feeMonth` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '费用月份，格式YYYY-MM',
    `stores` JSON NOT NULL COMMENT '关联门店/机构（字符串数组，JSON存储）',
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '价税合计金额',
    `status` VARCHAR(20) NOT NULL DEFAULT 'uploaded' COMMENT '状态：uploaded已上传/ocr-confirmed OCR已确认/pending待处理',
    `uploadTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '上传时间',
    `filePath` VARCHAR(500) NOT NULL DEFAULT '' COMMENT 'PDF文件存储路径',
    `ocrResult` JSON NOT NULL COMMENT 'OCR识别结果（JSON存储）',

    INDEX `invoices_batch_id_idx`(`batch_id`),
    INDEX `invoices_carrier_idx`(`carrier`),
    INDEX `invoices_feeMonth_idx`(`feeMonth`),
    INDEX `invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='发票表 — 存储上传的发票PDF及OCR识别结果';

-- CreateTable
CREATE TABLE `detail_tables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '明细表主键ID，自增',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通',
    `feeMonth` VARCHAR(10) NOT NULL COMMENT '费用月份，格式YYYY-MM',
    `fileName` VARCHAR(255) NOT NULL COMMENT '原始文件名',
    `uploadTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '上传时间',
    `sheetCount` INTEGER NOT NULL DEFAULT 0 COMMENT 'Sheet页数量',
    `totalNumbers` INTEGER NOT NULL DEFAULT 0 COMMENT '总号码数量',
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '总金额',
    `sheets` JSON NOT NULL COMMENT 'Sheet页数据，JSON存储DetailSheet[]',

    INDEX `detail_tables_carrier_idx`(`carrier`),
    INDEX `detail_tables_feeMonth_idx`(`feeMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='电信明细表 — 存储运营商提供的电信费用明细Excel解析结果';

-- CreateTable
CREATE TABLE `accruals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '计提记录主键ID，自增',
    `batch_id` INTEGER NOT NULL COMMENT '发票批次ID，关联invoice_batches表',
    `batchNo` VARCHAR(20) NOT NULL COMMENT '批次编号',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通',
    `feeMonth` VARCHAR(10) NOT NULL COMMENT '费用月份，格式YYYY-MM',
    `method` VARCHAR(20) NOT NULL COMMENT '计提方式：detail明细计提/invoice发票计提',
    `totalAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '总金额',
    `status` VARCHAR(20) NOT NULL DEFAULT 'generated' COMMENT '状态：generated已生成/printed已打印',
    `createTime` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) COMMENT '创建时间',
    `creator` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '创建人',
    `groups` JSON NOT NULL COMMENT '计提分组数据，JSON存储AccrualGroup[]',

    INDEX `accruals_batch_id_idx`(`batch_id`),
    INDEX `accruals_carrier_idx`(`carrier`),
    INDEX `accruals_feeMonth_idx`(`feeMonth`),
    INDEX `accruals_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='计提记录表 — 存储按批次生成的计提分组和金额';

-- CreateTable
CREATE TABLE `contracts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '合同主键ID，自增',
    `title` VARCHAR(255) NOT NULL COMMENT '合同标题',
    `supplierName` VARCHAR(200) NOT NULL COMMENT '供应商名称',
    `type` VARCHAR(50) NOT NULL COMMENT '合同类型：宽带/设备采购/项目/采购/维保',
    `amount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '合同金额',
    `signDate` VARCHAR(10) NOT NULL COMMENT '签订日期，格式YYYY-MM-DD',
    `expireDate` VARCHAR(10) NOT NULL COMMENT '到期日期，格式YYYY-MM-DD',
    `fileName` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '合同附件文件名',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',

    INDEX `contracts_type_idx`(`type`),
    INDEX `contracts_expireDate_idx`(`expireDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='合同表 — 存储宽带、设备采购、项目等各类合同信息';

-- CreateTable
CREATE TABLE `budget_details` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '预算明细主键ID，自增',
    `fiscalYear` INTEGER NOT NULL COMMENT '财年（如2026表示26财年=2026.4~2027.3）',
    `storeName` VARCHAR(100) NOT NULL COMMENT '门店名称',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商：电信/移动/联通/其他',
    `feeType` VARCHAR(50) NOT NULL COMMENT '费用类型：宽带/固话手机/物联网/监控/云服务',
    `monthlyFee` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '月度费用',
    `annualFee` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '年度费用',
    `feeRange` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '费用范围，格式YYYY-MM~YYYY-MM',
    `broadbandType` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '宽带类型（如100M、200M、专线等）',
    `paymentMethod` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '缴费方式：年缴费/月缴费',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',

    INDEX `budget_details_fiscalYear_idx`(`fiscalYear`),
    INDEX `budget_details_storeName_idx`(`storeName`),
    INDEX `budget_details_carrier_idx`(`carrier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='预算明细表 — 存储每个财年各门店各运营商的费用预算';

-- CreateTable
CREATE TABLE `budget_executions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '预算执行主键ID，自增',
    `fiscalYear` INTEGER NOT NULL COMMENT '财年',
    `storeName` VARCHAR(100) NOT NULL COMMENT '门店名称',
    `carrier` VARCHAR(20) NOT NULL COMMENT '运营商',
    `month` VARCHAR(10) NOT NULL COMMENT '月份，格式YYYY-MM',
    `budgetAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '预算金额',
    `actualAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0 COMMENT '实际金额',

    INDEX `budget_executions_fiscalYear_idx`(`fiscalYear`),
    INDEX `budget_executions_storeName_idx`(`storeName`),
    INDEX `budget_executions_month_idx`(`month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='预算执行表 — 存储每个月的预算与实际执行对比数据';

-- CreateTable
CREATE TABLE `payment_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '支付配置主键ID，自增',
    `storeId` VARCHAR(20) NOT NULL COMMENT '机构代码（关联门店）',
    `storeName` VARCHAR(100) NOT NULL COMMENT '门店名称',
    `payMethod` VARCHAR(20) NOT NULL COMMENT '支付方式代码：wx微信/zfb支付宝/yl银联/yzf翼支付',
    `payMethodName` VARCHAR(20) NOT NULL COMMENT '支付方式名称：微信/支付宝/银联/翼支付',
    `provider` VARCHAR(50) NOT NULL COMMENT '服务商：中国邮政/昂捷/昂捷离线付',
    `configName` VARCHAR(100) NOT NULL COMMENT '配置项名称：商户号/密钥/APPID等',
    `configValue` VARCHAR(2000) NOT NULL DEFAULT '' COMMENT '配置项值',
    `posNo` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'POS机编号',
    `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用',
    `isSensitive` BOOLEAN NOT NULL DEFAULT false COMMENT '是否敏感信息（敏感信息在界面脱敏显示）',

    INDEX `payment_configs_storeName_idx`(`storeName`),
    INDEX `payment_configs_payMethod_idx`(`payMethod`),
    INDEX `payment_configs_provider_idx`(`provider`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='支付配置表 — 存储各门店的支付方式和服务商配置信息';

-- CreateTable
CREATE TABLE `servers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '服务器主键ID，自增',
    `name` VARCHAR(100) NOT NULL COMMENT '服务器名称',
    `serverType` VARCHAR(50) NOT NULL COMMENT '服务器类型：本地/阿里云/腾讯云/华为云/自定义',
    `cloudAccount` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '云账号（云服务器专属）',
    `internalIp` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '内网IP',
    `externalIp` VARCHAR(50) NOT NULL DEFAULT '' COMMENT '外网IP',
    `port` VARCHAR(10) NOT NULL DEFAULT '22' COMMENT 'SSH/远程端口，默认22',
    `cpuModel` VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'CPU型号',
    `cpuCores` VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'CPU核数',
    `memorySize` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '内存大小',
    `systemDiskSize` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '系统盘大小',
    `dataDiskSize` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '数据盘大小',
    `diskType` VARCHAR(20) NOT NULL DEFAULT '' COMMENT '磁盘类型：SSD/HDD/SSD+HDD',
    `os` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '操作系统',
    `expireDate` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '到期日期，格式YYYY-MM-DD',
    `purpose` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '用途说明',
    `account` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '服务器登录账号',
    `password` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '服务器登录密码（敏感，应用层加密）',
    `dbAccount` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '数据库账号',
    `dbPassword` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '数据库密码（敏感）',
    `dbPort` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '数据库端口',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',
    `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用',

    INDEX `servers_serverType_idx`(`serverType`),
    INDEX `servers_status_idx`(`status`),
    INDEX `servers_expireDate_idx`(`expireDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='服务器表 — 存储本地和云服务器配置信息';

-- CreateTable
CREATE TABLE `domains` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '域名主键ID，自增',
    `domain` VARCHAR(200) NOT NULL COMMENT '域名',
    `mainAccount` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '主账号',
    `mainPassword` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '主账号密码（敏感）',
    `certType` VARCHAR(20) NOT NULL DEFAULT '' COMMENT 'SSL证书类型：DV/OV/EV',
    `certIssuer` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '证书颁发机构',
    `certRenewDate` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '证书续签日期，格式YYYY-MM-DD',
    `certExpireDate` VARCHAR(10) NOT NULL DEFAULT '' COMMENT '证书到期日期，格式YYYY-MM-DD',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',
    `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用',

    INDEX `domains_status_idx`(`status`),
    INDEX `domains_certExpireDate_idx`(`certExpireDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='域名表 — 存储域名及SSL证书信息';

-- CreateTable
CREATE TABLE `miniapps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT COMMENT '小程序主键ID，自增',
    `name` VARCHAR(100) NOT NULL COMMENT '小程序名称',
    `email` VARCHAR(100) NOT NULL DEFAULT '' COMMENT '关联邮箱',
    `emailPassword` VARCHAR(255) NOT NULL DEFAULT '' COMMENT '邮箱密码（敏感）',
    `remark` VARCHAR(1000) NOT NULL DEFAULT '' COMMENT '备注',
    `status` VARCHAR(10) NOT NULL DEFAULT '正常' COMMENT '状态：正常/停用',

    INDEX `miniapps_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT='小程序表 — 存储微信小程序账号和邮箱信息';

-- AddForeignKey
ALTER TABLE `operation_logs` ADD CONSTRAINT `operation_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `invoices_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `invoice_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
