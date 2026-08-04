# Docker Compose 部署指南

本目录是 IT_IMP 的正式容器部署入口。Docker 构建直接使用仓库根目录的 `web/` 源码，不存在第二套 Docker 业务代码。

## 运行要求

- Linux 主机；
- Docker Engine 24+；
- Docker Compose 插件（命令为 `docker compose`）；
- 已开放应用访问端口，默认 `3000`。

## 首次部署

```bash
git clone https://github.com/linjuli1956/IT_IMP.git
cd IT_IMP/deploy/docker

cp .env.docker.example .env.docker
cp secrets/mysql_root_password.txt.example secrets/mysql_root_password.txt
cp secrets/jwt_secret.txt.example secrets/jwt_secret.txt

# 写入随机密码与 JWT 密钥；这两个文件不会提交到 Git
openssl rand -base64 24 | tr -d '\n' > secrets/mysql_root_password.txt
openssl rand -hex 32 > secrets/jwt_secret.txt
chmod 600 secrets/*.txt

# 可选：部署前编辑 .env.docker，修改平台名称、端口和首次管理员密码
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
```

浏览器访问 `http://服务器地址:3000`。

## 首次管理员

基础 Compose 默认创建首个管理员：

```text
账号：admin
密码：123456
```

在执行首次 `up` 前，可编辑 `.env.docker`：

```dotenv
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=请改成至少 6 位的强密码
```

管理员仅在 `users` 表为空时创建一次。后续重启容器、升级镜像或修改这两个环境变量，都不会覆盖已有用户或密码。首次登录后应立即在系统中修改密码。

生产环境若希望首次管理员密码也以文件保存，可创建 `secrets/initial_admin_password.txt`，并使用可选配置：

```bash
cp secrets/initial_admin_password.txt.example secrets/initial_admin_password.txt
chmod 600 secrets/initial_admin_password.txt
docker compose -f docker-compose.yml -f docker-compose.secrets.yml --env-file .env.docker up -d --build
```

该 Secret 的值优先于 `.env.docker` 中的 `INITIAL_ADMIN_PASSWORD`。

## 常用操作

```bash
# 查看服务状态和 Web 日志
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f web

# 更新源码后重新构建并启动
git pull
docker compose --env-file .env.docker up -d --build

# 停止服务（保留数据库与上传文件）
docker compose --env-file .env.docker down
```

数据持久化位置：

- MySQL：`deploy/docker/data/mysql/`
- 应用上传文件：`deploy/docker/data/app/`

备份时应停止写入或使用 MySQL 的一致性备份工具；不要把 `data/`、`.env.docker` 或 `secrets/*.txt` 提交到 Git。

## 配置项

编辑 `.env.docker` 后，使用 `docker compose --env-file .env.docker up -d` 应用修改。

| 配置项 | 作用 | 默认值 |
| --- | --- | --- |
| `WEB_PORT` | Web 对外端口 | `3000` |
| `NUXT_PUBLIC_APP_NAME` | 平台显示名称 | `综合管理平台` |
| `INITIAL_ADMIN_USERNAME` | 首次管理员账号 | `admin` |
| `INITIAL_ADMIN_PASSWORD` | 首次管理员密码 | `123456` |
| `TZ` | 容器时区 | `Asia/Shanghai` |
| `MYSQL_BIND_ADDRESS` | MySQL 的宿主机监听地址 | `127.0.0.1` |
| `MYSQL_PORT` | MySQL 宿主机端口 | `3306` |

MySQL 仅供应用容器使用；默认只绑定宿主机回环地址。除非确有必要，不要将 `MYSQL_BIND_ADDRESS` 改为 `0.0.0.0`。

## 忘记管理员密码

先在 `.env.docker` 中设置新的 `INITIAL_ADMIN_PASSWORD`，然后在数据库和 `db` 容器可用时执行：

```bash
docker compose --env-file .env.docker run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```

命令只重置 `INITIAL_ADMIN_USERNAME` 指定账号的密码，不会重建数据库、执行 Seed 或修改其他用户。若使用 `initial_admin_password.txt` Secret，请使用它的值，并在命令中叠加 `docker-compose.secrets.yml`。

数据库不可连接时不能重置密码，因为密码哈希保存在数据库中；应先恢复数据库服务、网络或数据卷。
