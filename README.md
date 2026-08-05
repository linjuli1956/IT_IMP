# IT_IMP

一个可自托管的综合管理平台。项目维护一套 `web/` 业务源码，并提供 Windows EXE 与 Docker Compose 两种部署方式。

当前发布日期版本：`20260805`。

## Docker Compose（推荐）

用户直接拉取 Docker Hub 镜像，不需要下载源码或构建镜像：

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

桌面配置工具用于配置数据库、初始化空数据库、创建首个管理员和启动本地 Web 服务。发布时必须将 `platform-config.exe`、`bun/` 和 `web/` 作为完整目录一起复制。

构建发布包：

```powershell
.\desktop\build-release.ps1
```

发布包位于 `desktop/build/release/IT_IMP-20260805/`，配置工具默认显示“综合管理平台-配置工具 20260805”。

## 项目结构

- `web/`：Nuxt、Vue、Prisma 业务源码，Docker 与 EXE 共用；
- `desktop/`：Wails Windows 桌面配置工具；
- `deploy/docker/`：单文件 Compose、镜像构建文件与容器启动脚本；
- `docs/`：面向部署者和贡献者的公开说明；
- `data/`：仅保留空目录占位文件，不含业务数据。

## 开发与测试

开发环境需要 Node.js 24+；构建 Windows EXE 还需要 Go 1.25+、Wails 与 WebView2 Runtime。

```powershell
npm.cmd --prefix web install
npm.cmd --prefix web run build
npm.cmd --prefix web test
```

贡献方式见 [贡献指南](CONTRIBUTING.md)。请勿提交密码、JWT、数据库备份、上传文件、真实业务数据、`node_modules` 或构建产物。

## 许可证与安全

本项目以 [Apache-2.0](LICENSE) 许可证发布。安全问题请按照 [安全策略](SECURITY.md) 私密报告；第三方依赖许可证见 [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)。
