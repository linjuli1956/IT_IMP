# Docker Compose 镜像部署

IT_IMP 采用单文件 Compose 部署：直接拉取 Docker Hub 镜像，不需要 `.env`、源码、Node.js 或本机构建。

## 用户部署

```bash
mkdir -p /vol1/1000/docker/IT_IMP_docker
cd /vol1/1000/docker/IT_IMP_docker
curl -fsSLO https://raw.githubusercontent.com/linjuli1956/IT_IMP/main/deploy/docker/docker-compose.yml
nano docker-compose.yml
docker compose up -d
```

首次只需在 `docker-compose.yml` 顶部的“部署配置”区域修改三项：

- `MYSQL_ROOT_PASSWORD`：MySQL root 密码；
- `JWT_SECRET`：用于登录认证的长随机密钥；
- `INITIAL_ADMIN_PASSWORD`：首次管理员密码。

未修改公开占位值时，Compose 会在启动数据库前停止并提示配置错误。

## 端口与数据目录

默认端口：

```text
Web：31956 -> 3000，访问 http://NAS_IP:31956
MySQL：3307 -> 3306，局域网通过 NAS_IP:3307 以 root 登录
```

默认数据目录相对于 Compose 文件：

```text
./data/mysql  数据库文件
./data/app    PDF、XLSX、附件与日志
```

NAS 需要固定路径时，直接在 Compose 顶部将两个目录改为：

```text
/vol1/1000/docker/IT_IMP_docker/data/mysql
/vol1/1000/docker/IT_IMP_docker/data/app
```

MySQL 的远程 root 权限只在空数据目录首次初始化时创建。已有数据库不会因为修改 Compose 自动改变账号权限。

## 镜像版本与更新

默认镜像是 `linjuli2026/it-imp-web:latest`。若要固定到某次日期发布，将 `web` 服务的镜像改为：

```yaml
image: linjuli2026/it-imp-web:20260805
```

更新最新镜像：

```bash
docker compose pull
docker compose up -d
```

## 管理员密码恢复

先在 Compose 顶部修改 `INITIAL_ADMIN_PASSWORD`，再执行：

```bash
docker compose run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```

该命令只重置指定管理员密码，不会重建数据库或修改其他用户。数据库不可连接时不能重置密码，因为密码哈希存储在 MySQL 中。
