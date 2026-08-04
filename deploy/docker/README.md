# Docker Compose 镜像部署

这是正式部署方式：Compose 直接拉取 IT_IMP 已发布的镜像，不下载源码，也不在用户服务器上构建镜像。

## 用户部署命令

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker
cd /vol1/1000/docker/IT_IMP_docker

curl -fsSLO https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/docker-compose.yml
curl -fsSLo .env https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/.env.example

nano .env
docker compose up -d
```

`docker compose up -d` 会自动拉取：

- `ghcr.io/linjuli1956/it-imp-web:latest`：IT_IMP 应用镜像；
- `mysql:8.0`：内置 MySQL 镜像。

## 首次只修改四项

`.env` 是唯一需要修改的文件：

```dotenv
# NAS/Linus 的数据总目录；可保留 ./data 使用当前 Compose 目录。
DATA_DIR=/vol1/1000/docker/IT_IMP_docker/data

# 对外网站端口；例如 7000 对应 http://服务器地址:7000
WEB_PORT=7000

# 替换为自己的值，不能使用示例值
MYSQL_ROOT_PASSWORD=你的数据库强密码
JWT_SECRET=你的长随机密钥

# 首次管理员；只在空数据库第一次启动时创建
INITIAL_ADMIN_PASSWORD=你的首次管理员密码
```

其余配置可以保持默认。Docker 会自动创建 `${DATA_DIR}/mysql` 和 `${DATA_DIR}/app`。

## 数据与端口

- `${DATA_DIR}/mysql`：内置 MySQL 的数据库文件；
- `${DATA_DIR}/app`：上传的 PDF、XLSX、附件和日志；
- Web 默认端口为 `3000`，改 `WEB_PORT` 即可；
- MySQL 默认只监听服务器本机，不对公网开放；Web 通过内部 `db:3306` 连接数据库；
- `TZ=Asia/Shanghai` 与 `MYSQL_TIME_ZONE=+08:00` 默认已配置。

## 更新与运维

```bash
# 拉取最新镜像并重建容器，保留数据
docker compose pull
docker compose up -d

# 查看日志
docker compose logs -f web

# 停止服务，保留数据库和上传文件
docker compose down
```

首次登录账号默认为 `admin`，密码由 `.env` 的 `INITIAL_ADMIN_PASSWORD` 决定。若忘记管理员密码，先修改该配置，再执行：

```bash
docker compose run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```
