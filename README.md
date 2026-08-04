# IT_IMP

一个可自托管的综合管理平台。项目只维护一套 `web/` 业务源码，并提供两种部署方式：

- **Docker Compose（推荐）**：适合 Linux 服务器部署；
- **Windows EXE**：提供桌面配置工具，用于本地配置与启动服务。

当前开发版本：`v0.0001`。

## Docker Compose 快速开始

准备一台已安装 Docker Engine 和 Docker Compose 插件的 Linux 主机。用户不需要克隆源码、不需要安装 Node.js 或 Go，也不需要本机构建镜像：

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker
cd /vol1/1000/docker/IT_IMP_docker
curl -fsSLO https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/docker-compose.yml
curl -fsSLo .env https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/.env.example
nano .env                    # 首次仅修改 DATA_DIR、两个密钥和管理员密码
docker compose up -d
docker compose ps
```

默认访问地址为 `http://服务器地址:3000`。首次登录账号为 `admin`，密码为 `123456`；请在首次部署前通过 `.env` 修改 `INITIAL_ADMIN_PASSWORD`，或在首次登录后立即修改密码。

完整的配置、更新、日志、备份及密码重置说明见 [Docker Compose 部署指南](deploy/docker/README.md)。

## Windows EXE

桌面配置工具用于配置数据库、初始化空数据库、创建首个管理员和启动本地 Web 服务。可分发版本必须将 `platform-config.exe`、`bun/` 和 `web/` 目录作为一个完整发布包一起复制，不能只复制 EXE 文件。

构建发布包：

```powershell
.\desktop\build-release.ps1
```

产物位于 `desktop/build/release/IT_IMP-v0.0001/`。管理员创建和密码恢复规则见 [管理员账号与密码](docs/管理员账号与密码.md)。

## 项目结构

- `web/`：Nuxt、Vue、Prisma 业务源码，Docker 与 EXE 共用；
- `desktop/`：Wails 桌面配置工具；
- `deploy/docker/`：Docker Compose、Dockerfile 和容器启动脚本；
- `docs/`：面向部署者和贡献者的公开说明；
- `data/`：本地运行目录，仅保留空目录占位文件，不含任何业务数据。

## 开发与测试

开发环境需要 Node.js 24+；构建 Windows EXE 还需要 Go 1.25+、Wails 与 WebView2 Runtime。

```powershell
npm.cmd --prefix web install
npm.cmd --prefix web run build
npm.cmd --prefix web test
```

贡献方式见 [贡献指南](CONTRIBUTING.md)。请勿提交 `.env`、密码、密钥、数据库备份、上传文件、真实业务数据、`node_modules` 或构建产物。

## 许可证与安全

本项目以 [Apache-2.0](LICENSE) 许可证发布。安全问题请按照 [安全策略](SECURITY.md) 私密报告；第三方依赖许可证见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
