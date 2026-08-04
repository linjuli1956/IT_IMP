# Docker Compose 部署指南

本目录是 IT_IMP 的唯一 Docker 部署入口。用户只需要复制并修改一个 `.env` 文件，然后执行 `docker compose up`。

## 一键部署

```bash
git clone https://github.com/linjuli1956/IT_IMP.git
cd IT_IMP/deploy/docker
cp .env.example .env
nano .env
docker compose up -d --build
```

查看状态与日志：

```bash
docker compose ps
docker compose logs -f web
```

默认访问地址是 `http://服务器地址:3000`。

## 只需要修改 `.env`

以下是最常用的配置。其余项目已有默认值，首次测试无需改动。

```dotenv
# 数据总目录。MySQL 使用 ${DATA_DIR}/mysql，上传文件使用 ${DATA_DIR}/app。
DATA_DIR=/vol1/1000/docker/IT_IMP_docker/data

# 网站端口；例如 7000 对应 http://服务器地址:7000
WEB_PORT=7000

# 平台显示名称和时区
NUXT_PUBLIC_APP_NAME=综合管理平台
TZ=Asia/Shanghai
MYSQL_TIME_ZONE=+08:00

# 必须替换为自己的强密码和随机 JWT 密钥
MYSQL_ROOT_PASSWORD=请替换为数据库强密码
JWT_SECRET=请替换为长随机字符串

# 首次管理员，仅在空数据库首次启动时创建
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=请替换为首次管理员密码
```

Docker 会自动创建以下目录；也可以提前创建：

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker/data/mysql
mkdir -p /vol1/1000/docker/IT_IMP_docker/data/app
```

## 数据保存方式

Compose 会启动独立的 MySQL 容器，并自动创建 `MYSQL_DATABASE` 指定的数据库。数据库文件必须持久化，否则删除容器后账号和业务数据会丢失。

- `${DATA_DIR}/mysql`：MySQL 的库、表、账号和业务数据；
- `${DATA_DIR}/app`：用户上传的 PDF、XLSX、附件和应用日志；
- MySQL 仅保存文件路径和业务关联信息，不保存 PDF/XLSX 的二进制内容。

默认 MySQL 只监听 `127.0.0.1`，不对公网开放。Web 容器始终通过 Docker 内部地址 `db:3306` 访问它；不要把 `DATABASE_PORT` 改为宿主机的 `MYSQL_PORT`。

## 常用命令

```bash
# 更新代码并重新构建
git pull
docker compose up -d --build

# 停止服务，但保留数据目录
docker compose down

# 查看全部日志
docker compose logs -f
```

## 忘记管理员密码

先修改 `.env` 中的 `INITIAL_ADMIN_PASSWORD`，然后执行：

```bash
docker compose run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```

此命令只重置指定管理员密码，不会重建数据库、不执行 Seed，也不会修改其他用户。数据库不可连接时不能重置密码，因为密码哈希保存在 MySQL 中。
