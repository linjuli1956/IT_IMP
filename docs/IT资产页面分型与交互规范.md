# IT 资产页面分型与交互规范

> 阶段：阶段 0（设计稿与交互规范） · 状态：待审计确认 · 日期：2026-08-10
> 适用：Nuxt Web 端 `app/pages/it/*` 资产模块统一改版的设计依据；阶段 1 编码须严格遵循本文档。

---

## 1. 文档定位与冻结边界

### 1.1 背景
当前发布候选（EXE + Docker）处于验收冻结期。本文档新开"IT 资产页面分型设计"阶段，**只产出设计文档 + 静态假数据稿 + 双视口截图 + 复用组件边界**，完成后交审计确认，不进入阶段 1 正式编码。

### 1.2 冻结边界（本阶段绝不触碰）
| 禁止修改 | 说明 |
|---|---|
| `app/pages/it/*.vue` | 七个正式资产页面（servers/network-devices/computers/phones/scales/domains/miniapps）现状不动 |
| 服务器模块交互 | `it/servers.vue` 已冻结的卡片工作台 + Tab + 树形双视图 + Drawer 交互维持不变 |
| `prisma/schema.prisma` | 数据库结构不改 |
| `web/server/api/*` | 后端 API 不改 |
| 正式组件契约 | 现有 `AssetTable/AssetFormDialog/AssetFilters` 对 `it/*.vue` 的调用契约不改（row-click 扩展为可选、向后兼容） |

### 1.3 本阶段产物落点
`docs/` · `app/pages/design/` · `app/components/design/` · `web/scripts/` · `screenshots/design-stage/`，均不进入正式业务路径。

---

## 2. 三种统一页面模式

| 模式 | 适用模块 | 默认形态 | 选型理由 |
|---|---|---|---|
| **关系型资产工作台** | 服务器 | 卡片总览 + 树形辅助 + 详情抽屉 | 存在宿主机↔虚拟机父子关系、平台语义，需多视图表达 |
| **台账型资产** | 网络设备、电脑、固话、电子秤 | 强化表格 + 点击行→详情抽屉 | 数量多、需搜索筛选批量管理、横向对比字段 |
| **服务型资产** | 域名、小程序 | 卡片网格 + 点击卡片→详情抽屉 | 数量少，适合看状态/到期/负责人/管理入口 |

> 设计目标不是"所有资产页改卡片"，而是按资产特性匹配三种统一模式，避免页面间交互割裂。

---

## 3. 全局交互统一规则

| 交互行为 | 统一约定 |
|---|---|
| **Hover** | `RecordPreviewTooltip` 快速预览，4–8 行精简字段；**不承载完整信息**，敏感字段绝不进入 tooltip DOM（`filterSensitiveRows`） |
| **点击行 / 卡片** | 打开统一 `AssetDetailDrawer`，展示完整字段 + 关联信息 + 操作 |
| **编辑 / 删除按钮** | `@click.stop` 阻止冒泡，不误触发抽屉；表格操作列 `fixed=right`，卡片放右上角"更多"菜单 |
| **表格着色** | 不铺整行大色块；仅对名称、状态、IP、预警日期、类型 Tag 做**字段级着色** |
| **卡片用途** | 仅用于低数量或关系强的资产（域名/小程序），禁止"所有页面卡片化" |
| **空态** | `EmptyState` 统一渲染，与表格互斥（有数据显表格/卡片，无数据显 EmptyState） |
| **筛选** | `AssetFilters`（台账型）或轻量搜索框（服务型）；切筛选回第 1 页 |
| **分页** | 台账型后端分页（`AssetTable` 内置 `el-pagination`）；服务型前端不分页（数量少） |

---

## 4. 颜色语义统一规则

### 4.1 着色对象与口径
| 着色对象 | 方式 | token / 工具 |
|---|---|---|
| 名称 / 类型 | 业务语义色（文字或 Tag） | `--server-type-*` / `--cert-type-*` / `--miniapp-*` / `--tone-*` |
| IP / 号码 / 端口 | 等宽字体 + 主题色文字 | `font-family: var(--font-family-mono)` + `color: var(--color-primary)` |
| 状态 | el-tag 统一色 | `getAssetStatusTagType()`：正常→success / 报废→danger / 停用→info |
| 到期 / 校准 / 保修预警 | el-tag 强语义色 | `getExpireInfo()` / `getCalibrationInfo()`：≤30天 danger / ≤90天 warning / 其余 info |
| 配置摘要（CPU/内存/磁盘） | 仅图标/标签着色，数值保持 `--text-primary` | `--spec-cpu` / `--spec-memory` / `--spec-disk` |

### 4.2 硬性约束
- **禁止整行底色**：`domains.vue`/`miniapps.vue` 现有的 `cert-type-*-bg` / `miniapp-active-bg` 整行底色属违规，服务型重设计改为字段级 Tag 着色后消除。
- **禁止硬编码颜色**：所有颜色走 `tokens.css` 变量；新增业务配色遵循 `--{域}-{值}-bg/border/text` 命名模式集中追加。
- **VM 平台色继承宿主**：树形列表 VM 子节点平台色继承宿主机，不重新判断赋值。

### 4.3 预警阈值（全局统一，禁止各模块自定义）
| 维度 | danger（红） | warning（橙） | info（灰） | null |
|---|---|---|---|---|
| 证书/合同到期 `getExpireInfo` | ≤30 天 | ≤90 天 | >90 天 | 无日期 |
| 校准 `getCalibrationInfo` | ≤30 天（含逾期/今天） | ≤90 天 | >90 天 | 停用/报废/无日期 |
| 保修到期（电脑） | ≤30 天 | ≤90 天 | >90 天 | 无日期 |

---

## 5. 复用组件边界

### 5.1 组件清单
| 组件 | 路径 | 职责 | 本阶段处置 |
|---|---|---|---|
| **AssetDetailDrawer** | `common/AssetDetailDrawer.vue` | 通用右侧详情抽屉（响应式宽度：≥1440→560px / ≥1200→520px / <1200→92vw；header/default/footer 三插槽，footer sticky） | **直接复用**，六模块统一详情容器 |
| **AssetTable** | `asset/AssetTable.vue` | 配置化列表格（列驱动 + status 自动 Tag + 分页 + 操作列） | **扩展** row-click 事件（向后兼容可选） |
| **RecordPreviewTooltip** | `common/RecordPreviewTooltip.vue` | Hover 快速预览（纯前端 DTO，禁止 hover API） | 直接复用 |
| **ServiceAssetCard** | `design/ServiceAssetCard.vue`（新增） | 服务型通用卡片（props 驱动字段、右上角"更多"菜单、stopPropagation、敏感字段不入卡片） | 新增 |
| **CalibrationWorkbench** | `design/CalibrationWorkbench.vue`（新增） | 电子秤校准工作台（逾期/1-30天/31-90天/>90天 四状态卡 + 列表入口） | 新增 |
| StatCard / PageHeader / EmptyState / SensitiveValue | `common/*` | 指标卡 / 页头 / 空态 / 敏感值脱敏 | 直接复用 |

### 5.2 资产字段渲染工具（`utils/asset-utils.ts` + `utils/preview-utils.ts`）
| 函数 | 作用 | 复用要求 |
|---|---|---|
| `getAssetStatusTagType(status)` | 状态→el-tag type | 全模块状态列统一 |
| `getExpireInfo(date)` | 到期天数 + tagType + label | 域名证书、电脑保修统一 |
| `getCalibrationInfo(date, status)` | 校准天数 + tone + label + overdue | 电子秤专用 |
| `formatPreviewValue(v)` | 空值→—，0/false 正常显示 | Hover/Drawer 字段兜底 |
| `filterSensitiveRows(rows)` | 敏感行不进 tooltip DOM | 域名/小程序/支付强制 |
| `buildXxxPreviewRows(row)` | 各模块 Hover 行构造（4–8 行） | 直接复用现有六个 build 函数 |

### 5.3 AssetTable row-click 扩展契约（向后兼容）
```
新增 props:  rowClickable?: boolean            // 默认 false，不传则无行点击（正式 it/*.vue 零影响）
新增 emit:   row-click: [row: T]
新增样式:    .asset-table--clickable .el-table__row { cursor: pointer; }
操作列标识:  class-name="col-action"（不依赖中文 label）
触发条件:    rowClickable && 点击非操作列（onRowClick 检查 event.target.closest('.col-action')）
按钮阻断:    @click.stop 阻止冒泡到 row-click
```
阶段 0 仅 `design/ledger-workspace.vue` 消费该能力；阶段 1 经审计后再接入正式 `it/*.vue`。

---

## 6. 六模块逐个设计

### 6.1 服务器（关系型 · 维持现状）
- **形态**：卡片总览（全部/物理机/虚拟机 三 Tab）+ 树形列表双视图 + `AssetDetailDrawer`。
- **本次处置**：**不改**。其交互范式作为其他模块"详情抽屉 + 悬停预览"的参考基准。
- **复用**：`ServerHostCard` / `ServerVmCard` / `StatCard` / `RecordPreviewTooltip`。

### 6.2 网络设备（台账型 · 强化表格）
**默认展示字段（列序）**
| 列 | 渲染 | 颜色语义 |
|---|---|---|
| 名称 | 品牌+型号（虚拟列 slot） | 类型图标 + 主题色文字 |
| 设备类型 | el-tag center | 业务语义色（交换机/路由器/AP 区分） |
| 门店 | storeName slot | — |
| 品牌 / 型号 | 纯文本 | — |
| 管理IP | 等宽字体 | `--font-family-mono` + `--color-primary` |
| 端口数 | 小徽标（如 `24口`）center | `--color-info` 底 |
| 位置 | 纯文本 | — |
| 状态 | el-tag center | `getAssetStatusTagType` |

**Hover**：`RecordPreviewTooltip` → 类型/管理、品牌/型号/序列号、IP/MAC、端口/上联、固件/位置、状态（7 行，无敏感字段）。
**Drawer**：完整字段 = 名称 + 门店 + 类型/管理类型 + 品牌/型号/序列号 + 管理IP/MAC + 端口数/上联口 + 固件版本 + 安装位置 + 状态 + 备注；footer = 编辑/删除按钮。
**编辑/删除入口**：表格操作列（`fixed=right`），`@click.stop`。
**强化点**：设备类型图标与语义色；管理 IP 等宽；端口数小徽标。

### 6.3 电脑（台账型 · 强化表格）
**默认展示字段**
| 列 | 渲染 | 颜色语义 |
|---|---|---|
| 名称 | 品牌+型号（虚拟列） | 主题色文字 |
| 门店 / 使用人 / 部门 | 纯文本 | — |
| 资产编号 | 纯文本 | — |
| IP | 等宽字体 | `--font-family-mono` + `--color-primary` |
| 系统 | 纯文本 | — |
| 保修到期 | 日期 + el-tag | `getExpireInfo`：≤30天 danger / ≤90天 warning |
| 状态 | el-tag center | `getAssetStatusTagType` |

**分层显示**：名称（主）→ 门店/使用人/部门（次）→ IP/系统（技术）→ 保修/状态（预警）。
**Hover**：资产编号、门店、使用人、品牌/型号、配置（CPU/内存/硬盘/磁盘类型）、IP、保修到期（带 tone）、状态。
**Drawer**：完整配置 = CPU 型号/核数、内存 GB、硬盘 GB/类型、MAC、采购日期、序列号、系统版本 + 上述默认字段；footer = 编辑/删除。
**强化点**：保修到期黄/红提醒（与域名证书到期同口径）。

### 6.4 固话（台账型 · 紧凑表格）
**默认展示字段**
| 列 | 渲染 | 颜色语义 |
|---|---|---|
| 固话号码 | 虚拟列 slot | **最突出** · 等宽 + `--color-primary` + 加粗 |
| 门店 / 部门 / 使用人 | 纯文本 | — |
| 运营商 | center | el-tag（电信/移动/联通区分） |
| 分机号 | center | `--text-secondary` 辅助 |
| 位置 | 纯文本 | — |
| 状态 | el-tag center | `getAssetStatusTagType` |

**Hover**：门店、部门、号码/分机、运营商、月租、状态、备注。
**Drawer**：月租、套餐说明、安装位置、备注 + 上述字段；footer = 编辑/删除。
**强化点**：号码为第一信息；运营商、分机号、部门为辅助；**不适合卡片**。

### 6.5 电子秤（台账型 · 强化表格 + 校准工作台）
**默认展示字段**
| 列 | 渲染 | 颜色语义 |
|---|---|---|
| 名称 | 品牌+型号（虚拟列） | 主题色文字 |
| 门店 / 资产编号 | 纯文本 | — |
| 量程(kg) / 精度(g) | center | `--spec-*` 不用，数值 `--text-primary` |
| 接口 | center | el-tag |
| **下次校准** | el-tag slot | **强语义色** · `getCalibrationInfo`：逾期/今天→danger、≤30天→danger、≤90天→warning、>90天→info |
| 位置 | 纯文本 | — |
| 状态 | el-tag center | `getAssetStatusTagType` |

**Hover**：资产编号、门店、品牌/型号、量程/精度、位置、上次/下次校准、校准状态（tone）、状态。
**Drawer**：校准周期（天）、上次校准、序列号、备注 + 上述字段；footer = 编辑/删除。
**校准工作台视图**（见第 7 节）：逾期 / 1-30天 / 31-90天 / 正常 四状态卡聚合。
**强化点**：下次校准必须强语义颜色；校准工作台四状态卡。

### 6.6 域名（服务型 · 卡片网格）
**卡片展示字段**
| 卡片元素 | 渲染 | 颜色语义 |
|---|---|---|
| 域名 | 主标题 | `--text-primary` 加粗 |
| 服务商 | 副信息 | `--text-secondary` |
| SSL 证书类型 | el-tag | `--cert-type-*` 文字色（DV/OV/EV） |
| 到期倒计时 | el-tag 强色 | `getExpireInfo(certExpireDate)`：≤30天 danger / ≤90天 warning |
| 状态 | el-tag | `getAssetStatusTagType` |
| 管理入口 | 文字链接 | `--color-primary` |

**Hover**：`RecordPreviewTooltip` → 证书类型/机构、更换/到期日期、剩余天数（tone）、状态、备注（**不含主账号/密码**）。
**Drawer**：完整字段 + **敏感字段仅在抽屉按需显示**：主账号、主账号密码（用 `SensitiveValue` 脱敏，点击展开）；footer = 编辑/删除。
**编辑/删除入口**：卡片右上角"更多"菜单（`el-dropdown`），`@click.stop`。
**强化点**：到期倒计时强色；敏感字段不入卡片。

### 6.7 小程序（服务型 · 卡片网格）
**卡片展示字段**
| 卡片元素 | 渲染 | 颜色语义 |
|---|---|---|
| 名称 | 主标题 | `--text-primary` 加粗 |
| 绑定邮箱 | 副信息 | `--text-secondary` |
| 状态 | el-tag | 正常→`--miniapp-active-text` 绿 / 停用→`--miniapp-inactive` 红（字段级，非整行） |
| 负责人 / 备注 | 副信息 | `--text-secondary` |
| 管理入口 | 文字链接 | `--color-primary` |

**Hover**：绑定邮箱、状态、备注（**不含邮箱密码**）。
**Drawer**：邮箱密码（`SensitiveValue` 脱敏）+ 上述字段；footer = 编辑/删除。
**编辑/删除入口**：卡片右上角"更多"菜单，`@click.stop`。
**强化点**：状态字段级着色（消除整行底色违规）；邮箱密码仅抽屉。

---

## 7. 电子秤校准工作台视图

> 独立于列表的聚合视图，供信息部快速定位逾期/即将校准的电子秤。

**四状态卡**（`CalibrationWorkbench` 组件）
| 状态卡 | 判定 | 卡片色 | 内容 |
|---|---|---|---|
| 逾期 / 今天 | `getCalibrationInfo.overdue === true` | `--color-danger` + `--color-danger-light` | 数量 + 设备列表入口 |
| 1–30 天 | `!overdue && days !== null && days <= 30` | `--color-warning` + `--color-warning-light`（橙） | 数量 + 列表入口 |
| 31–90 天 | `!overdue && days !== null && days > 30 && days <= 90` | `--color-caution` + `--color-caution-light`（黄） | 数量 + 列表入口 |
| 正常 | `!overdue && days !== null && days > 90` | `--color-success` + `--color-success-light`（绿） | 数量 + 列表入口 |

**交互**：点击状态卡 → 过滤列表至该状态；列表仍用强化表格展示。
**数据口径**：仅 `status === '正常'` 参与校准提醒（停用/报废不显示，与 `getCalibrationInfo` 一致）。
**与后端规则一致**：getCalibrationInfo 单条 Tag 仍按 ≤30天 danger / ≤90天 warning / >90天 info 着色；工作台聚合卡在此基础上将 1-30天 拆为橙、>90天 标为绿，以提供更细粒度的视觉分层。

---

## 8. 静态稿交付物清单

| 产物 | 路径 | 说明 |
|---|---|---|
| 台账型聚合稿 | `app/pages/design/ledger-workspace.vue` | 网络设备/电脑/固话/电子秤四段强化表格 + 电子秤校准工作台 + AssetDetailDrawer；角色切换；假数据；筛选真实生效；自然响应式 |
| 服务型稿 | `app/pages/design/service-workspace.vue` | 域名/小程序卡片网格 + AssetDetailDrawer + 敏感字段仅抽屉；角色切换；假数据 |
| 服务型卡片 | `app/components/design/ServiceAssetCard.vue` | props 驱动通用卡片 |
| 校准工作台 | `app/components/design/CalibrationWorkbench.vue` | 三状态卡 + 列表入口 |
| 截图脚本 | `web/scripts/screenshot-design-stage.*` | Playwright，1366×768 + 1440×1024 |
| 截图产物 | `screenshots/design-stage/` | 双视口各分段 + 抽屉态 |

**静态稿范式**（遵循 `design/server-workspace.vue`）：
- 顶部注释声明"阶段 0 交付物，不请求 API，筛选真实生效，角色可切换，自然响应式不用视口模拟器"；
- 角色 switcher（管理员/查看者）控制 `canEdit`；
- `StatCard` 指标卡 + `filter-bar` + 主体 + Mock 组件 + `AssetDetailDrawer`；
- 走正常登录鉴权，无额外访问限制。

---

## 9. 设计原则汇总

1. **Hover 只快速预览**；点击卡片或行打开统一 `AssetDetailDrawer`。
2. **表格名称、IP、状态、预警日期、类型 Tag 使用统一语义着色**；IP/号码/端口等宽字体。
3. **域名/小程序卡片展示状态、到期、服务商、管理入口**；敏感字段（主账号/密码、邮箱密码）不在卡片中展示，仅在抽屉按需显示。
4. **电子秤突出校准逾期/即将校准**；电脑突出保修；网络设备突出类型、管理 IP、端口；固话突出号码和分机。
5. **禁止复制六份页面 CSS**；必须使用 token 和公共组件。
6. **参考 Vben 的层级、间距、抽屉与状态表达，不迁移其代码或技术架构**。

---

## 10. 验收 Checklist（审计用）

- [ ] 三种统一页面模式定义清晰，选型理由合理。
- [ ] 六模块逐个：信息层级 / 默认展示字段 / 颜色语义 / Hover 内容 / Drawer 内容 / 编辑删除入口 齐全。
- [ ] 颜色语义统一：token 引用准确，预警阈值全局一致，禁止整行底色。
- [ ] 复用组件边界明确：AssetDetailDrawer / AssetTable(row-click) / RecordPreviewTooltip / ServiceAssetCard / CalibrationWorkbench / 字段渲染工具。
- [ ] 域名/小程序卡片静态稿 + 抽屉态 + 敏感字段隔离。
- [ ] 网络设备/电脑/固话/电子秤强化表格静态稿 + 字段级着色 + 等宽 IP + 端口徽标 + 保修/校准预警。
- [ ] 电子秤校准工作台三状态卡。
- [ ] 1366×768 与 1440×1024 双视口截图。
- [ ] 冻结边界：it/*.vue / prisma / API / 服务器交互未改动。
- [ ] 静态稿遵循 server-workspace 范式（假数据/筛选真实/角色切换/自然响应式）。

---

## 附录 A · token 速查（本规范引用）

| 用途 | 变量 |
|---|---|
| 主色 | `--color-primary` `--color-primary-light` `--color-primary-border` |
| 功能色 | `--color-success` `--color-warning` `--color-danger` `--color-info` 及 `-light` |
| 等宽字体 | `--font-family-mono` |
| 服务器类型 | `--server-type-{local/aliyun/tencent/huawei/other}-{bg/hover}` |
| 平台/Tone | `--tone-{pve/esxi/aliyun/tencent/huawei/local/other}-{bg/border/text}` |
| 域名证书 | `--cert-type-{dv/ov/ev/none}-{bg/hover}` |
| 小程序 | `--miniapp-{active/inactive}-{bg/hover}` |
| 配置摘要 | `--spec-cpu` `--spec-memory` `--spec-disk` |
| 文字/边框/背景 | `--text-{primary/regular/secondary/placeholder}` `--border-{base/light/lighter}` `--bg-{page/card/hover}` |
| 圆角/间距/字号 | `--radius-*` `--spacing-*` `--font-size-*` |

## 附录 B · 工具函数速查

| 函数 | 签名 | 用途 |
|---|---|---|
| `getAssetStatusTagType` | `(status: string) => 'success'\|'info'\|'danger'` | 状态→el-tag type |
| `getExpireInfo` | `(date: string\|null) => {days, tagType, label}` | 到期预警（域名/电脑保修） |
| `getCalibrationInfo` | `(date, status, now?) => {days, label, tone, overdue}` | 校准预警（电子秤） |
| `formatPreviewValue` | `(v: unknown) => string` | 空值→— |
| `filterSensitiveRows` | `<T extends PreviewRowLike>(rows: T[]) => T[]` | 敏感行不进 tooltip DOM |
| `buildDevicePreviewRows` | `(row: NetworkDeviceItem) => PreviewRow[]` | 网络设备 Hover |
| `buildComputerPreviewRows` | `(row: ComputerItem) => PreviewRow[]` | 电脑 Hover |
| `buildPhonePreviewRows` | `(row: PhoneItem) => PreviewRow[]` | 固话 Hover |
| `buildScalePreviewRows` | `(row: ScaleItem) => PreviewRow[]` | 电子秤 Hover |
| `buildDomainPreviewRows` | `(row: DomainItem) => PreviewRow[]` | 域名 Hover |
| `buildMiniappPreviewRows` | `(row: MiniappItem) => PreviewRow[]` | 小程序 Hover |
