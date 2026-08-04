# IT_IMP

泰兴信息部管理平台。项目维护一套 `web/` 业务源码，同时提供 Windows EXE 和 Docker 两种部署方式。

当前版本：`v0.0001`（版本号文件：[`VERSION`](VERSION)）

## 目录结构

- `web/`：Nuxt/Vue/Prisma 业务源码，EXE 与 Docker 共用。
- `desktop/`：Wails Windows 桌面壳，负责启动本地业务服务并提供 EXE 入口。
- `deploy/docker/`：Docker Compose、Dockerfile 和容器入口脚本。
- `data/`：本地运行数据目录，不提交真实业务数据。
- `docs/`：公开技术文档；真实业务资料、PDF 和预算文件不进入公开仓库。

## 平台名称

默认平台名称为“综合管理平台”。桌面配置工具显示为“综合管理平台-配置工具V0.01”。

- EXE：在“数据库配置”页的“平台名称”中修改并保存；启动 Web 服务时会同步传入该名称。
- Docker：在 `deploy/docker/.env.docker` 中设置 `NUXT_PUBLIC_APP_NAME=你的平台名称`，然后重启 Web 服务。

## 开发环境

- Go 1.25+（Wails 桌面端）
- Node.js 24+ 与 npm
- Docker Desktop（容器部署）
- Windows 桌面端需要 WebView2 Runtime

业务源码安装依赖并运行：

```powershell
cd web
Copy-Item .env.example .env
npm install
npx prisma generate
npm run dev
```

## Windows EXE

```powershell
cd desktop
go install github.com/wailsapp/wails/v2/cmd/wails@v2.13.0
wails doctor
wails build
```

产物位于 `desktop/build/bin/platform-config.exe`。EXE 内置桌面壳，运行时需要能找到同目录发布包中的 `web/` 和 `bun/` 运行文件；开发构建时也会向上查找项目中的 `web/`。

### 生成可分发的 EXE 发布包

不能只分发单个 EXE。初始化数据库和启动本地 Web 服务需要同目录的 Bun 运行时及 Web 运行文件。请先安装 Bun，然后执行：

```powershell
.\desktop\build-release.ps1
```

脚本会生成 `desktop/build/release/IT_IMP-v0.0001/`，其中包含：

- `platform-config.exe`：桌面配置工具；
- `bun/bun.exe`：随包携带的 Bun 运行时；
- `web/`：Nuxt 构建产物、Prisma 迁移和运行依赖。

发布时请整体复制该目录，不要只复制 EXE。

## Docker

Docker 直接从根目录的 `web/` 构建，不维护第二份业务源码：

```powershell
cd deploy/docker
Copy-Item .env.docker.example .env.docker
Copy-Item .\secrets\mysql_root_password.txt.example .\secrets\mysql_root_password.txt
Copy-Item .\secrets\jwt_secret.txt.example .\secrets\jwt_secret.txt
# 编辑两个 .txt 文件：MySQL 密码、JWT 密钥
docker compose --env-file .env.docker up -d --build
```

首次启动必须创建本机 Docker Secret 文件，用于首次管理员密码；该文件不提交 Git。账号、密码、恢复方式和数据库不可达时的处理原则见 [管理员账号与密码](docs/管理员账号与密码.md) 与 [Docker 部署文档](deploy/docker/README.md)。

默认访问 `http://localhost:3000`。完整说明见 [`deploy/docker/README.md`](deploy/docker/README.md)。

## 测试与构建

```powershell
npm.cmd --prefix web run build
npm.cmd --prefix web test
```

如果 npm 11 提示阻止依赖安装脚本，请仍然显式执行 `npx prisma generate`；它会生成本地开发和构建所需的 Prisma 客户端。

测试需要先按 `web/.env.example` 配置环境。仓库不预置任何业务数据；首次部署执行 Prisma migrations 并创建一个首次管理员，其余业务表保持空白，业务数据由部署者自行录入。

## 安全与许可证

请勿提交 `.env`、数据库密码、商户密钥、真实业务数据或构建产物。安全问题请阅读 [`SECURITY.md`](SECURITY.md)。本项目源码按 [`Apache-2.0`](LICENSE) 发布；第三方依赖仍遵循其各自许可证，见 [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md)。
