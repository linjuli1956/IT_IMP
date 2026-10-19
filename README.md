# IT_IMP

一个可自托管的综合管理平台。项目维护一套 `web/` 业务源码，并提供 Windows EXE 与 Docker Compose 两种部署方式。

当前发布日期版本：`20261019`。

## Docker Compose（推荐）

用户直接拉取 Docker Hub 镜像，不需要下载源码或构建镜像：

> [直接查看或下载完整的带注释 `docker-compose.yml`](deploy/docker/docker-compose.yml)。该文件是唯一的公开 Compose 部署示例，顶部含密码、端口、时区和 NAS 数据目录的中文说明与示例。

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker
cd /vol1/1000/docker/IT_IMP_docker
curl -fsSLO https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/docker-compose.yml
nano docker-compose.yml
docker compose up -d
```

下载的 Compose 文件本身带有逐项中文注释、修改提示和示例。首次仅需在顶部修改 MySQL root 密码、JWT 密钥和首次管理员密码；保留中文占位值时会停止启动并提示修改。默认 Web 访问地址为 `http://服务器地址:31956`；MySQL 映射为局域网 `服务器地址:3307`。

完整说明见 [Docker Compose 部署指南](deploy/docker/README.md)。

## Windows EXE

桌面配置工具用于配置数据库、初始化空数据库、创建首个管理员和启动本地 Web 服务。

> ⚠️ **必须整目录运行**：`platform-config.exe` 运行时依赖同目录的 `bun\bun.exe` 与 `web\` 目录（用于执行 Prisma 迁移和启动 Web 服务）。请勿单独复制 exe 文件，否则会提示“未找到 Bun 运行时”。请使用下方发布脚本生成的完整发布包。

构建发布包：

```powershell
.\desktop\build-release.ps1
```

发布包位于 `desktop/build/release/IT_IMP-20261019/`，配置工具默认显示“综合管理平台-配置工具 20261019”。

> 发布脚本会自动寻找本机 Bun（`BUN_EXE` 环境变量 → `~/.bun/bin/bun.exe` → PATH）并复制进发布包的 `bun/` 目录；若本机未安装 Bun，请先安装：`powershell -c "irm bun.sh/install.ps1 | iex"`。

## 项目结构

- `web/`：Nuxt、Vue、Prisma 业务源码，Docker 与 EXE 共用；
- `desktop/`：Wails Windows 桌面配置工具；
- `deploy/docker/`：单文件 Compose、镜像构建文件与容器启动脚本；
- `docs/`：面向部署者和贡献者的公开说明；
- `data/`：仅保留空目录占位文件，不含业务数据。

## 开发与测试

开发环境需要 Node.js 24+；构建 Windows EXE 还需要 Go 1.25+、Wails 与 WebView2 Runtime。

本地完整门禁（提交前请在 `web/` 依次执行）：

```powershell
npm.cmd --prefix web ci
npm.cmd --prefix web exec -- prisma generate
npm.cmd --prefix web run typecheck
npm.cmd --prefix web test
npm.cmd --prefix web run build
```

修改 `desktop/` 时另需执行 `go test ./...` 与桌面前端构建，完整清单见 [贡献指南](CONTRIBUTING.md)。

## 本版本变更（20261019）

- 多张发票逐行体现：生成页新增「发票 → 计提明细行」映射，可 1:1 或 1:N（默认按顺序 1:1，可改）；1:N 平均分摊且可手动微调，预览实时联动；行备注自动带发票号/开票日期；未映射时保持原有规则；
- 计提表 Excel 下载：详情页「下载 Excel」改为前端内存生成 .xlsx（与打印版式一致，不在服务器落盘）。

## 上一版本变更（20261017）

- 计提生成支持选择计提月份：生成页内置月份选择器，默认费用月的下个月（如费用月 2026-09 → 计提月份 2026-10）；
- 计提表列表与详情同时展示「费用月」与「计提月份」，打印标题按计提月份显示；报销说明仍按费用月生成；
- 修复删除/更新已删除批次的计提表时报 500（Prisma P2025），批次状态同步改为容忍批次不存在。

## 更早版本（20260829）

- 计提表打印新增模板选择：A5 模板在一张 A4 上输出可裁切的横向 A5 版式；A4 模板使用自然分页，适合长表打印。

## 更早版本（20260818）

- 登录文件预览：合同/发票 PDF 预览改为在用户点击阶段预开空白窗口，避免浏览器丢失用户手势误拦截弹窗；token 仅走 Authorization 头，不进 URL；
- 域名/小程序/支付配置接口输入收紧：请求体类型与字段白名单校验、更新仅传白名单字段、非法 ID 与非法类型统一返回 400 而非 500；
- 桌面构建 `frontend:install` 改为 `npm ci`，锁定桌面前端依赖；
- 公开文档与示例中的版本引用统一（SECURITY.md、Compose 示例、发布脚本示例）；
- 仓库清理：移除已删除 design 原型页对应截图与失效截图脚本，冻结阶段 D 验收截图迁入 `screenshots/stage-d/`。

贡献方式见 [贡献指南](CONTRIBUTING.md)。请勿提交密码、JWT、数据库备份、上传文件、真实业务数据、`node_modules` 或构建产物。

## 许可证与安全

本项目以 [Apache-2.0](LICENSE) 许可证发布。安全问题请按照 [安全策略](SECURITY.md) 私密报告；第三方依赖许可证见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
