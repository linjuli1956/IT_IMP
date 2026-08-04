# IT_IMP Docker 部署

Docker 配置属于主项目的一部分，构建时直接使用 `../../web`，不再维护第二份源码。

## 首次启动

Windows PowerShell：

```powershell
cd C:\lsg\IT_IMP_V0.0001\IT_IMP\deploy\docker
Copy-Item .env.docker.example .env.docker
Copy-Item .\secrets\mysql_root_password.txt.example .\secrets\mysql_root_password.txt
Copy-Item .\secrets\jwt_secret.txt.example .\secrets\jwt_secret.txt
# 编辑两个 .txt 文件：分别写入 MySQL 密码和 JWT 密钥
docker compose --env-file .env.docker up -d --build
```

Linux：

```bash
cd /path/to/IT_IMP/deploy/docker
cp .env.docker.example .env.docker
cp secrets/mysql_root_password.txt.example secrets/mysql_root_password.txt
cp secrets/jwt_secret.txt.example secrets/jwt_secret.txt
# 编辑两个 .txt 文件：分别写入 MySQL 密码和 JWT 密钥
docker compose --env-file .env.docker up -d --build
```

访问地址默认为 `http://localhost:3000`。

## 首次管理员（必须阅读）

系统没有 Seed、示例业务数据或公开数据库快照；第一次成功迁移后只会创建一个管理员。基础 Compose 将 MySQL root 密码和 JWT 密钥作为 Docker Secrets 挂载；首次管理员则提供公开默认值，方便开箱即用。

默认示例是：

```text
账号：admin
密码：123456
```

这是基础 Compose 的默认值。可在首次启动前通过 `.env.docker` 修改账号或密码：

```text
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=123456
```

创建规则：

1. 容器先执行 Prisma 迁移，创建数据库表。
2. 只有 `users` 表没有任何用户时，才会用上述密码创建管理员。
3. 一旦已有任意用户，后续重启、更新镜像或修改环境变量都只会显示“跳过初始管理员创建”，绝不会覆盖现有密码或业务数据。
4. 首次登录后，请在右上角菜单选择“修改密码”。

生产环境如需将首次管理员密码也放入 Docker Secret，请复制密码示例文件并叠加可选配置：

```powershell
Copy-Item .\secrets\initial_admin_password.txt.example .\secrets\initial_admin_password.txt
docker compose -f docker-compose.yml -f docker-compose.secrets.yml --env-file .env.docker up -d --build
```

该 Secret 会覆盖 `.env.docker` 中的 `INITIAL_ADMIN_PASSWORD`。真实 Secret 文件已经被 `.gitignore` 排除。若它被误提交，请按 [SECURITY.md](../../SECURITY.md) 的泄露凭据流程立即更换相关密码/密钥和 Git 历史。

## 忘记管理员密码

在数据库仍可正常连接、`db` 服务已运行的前提下，先把 `.env.docker` 中的 `INITIAL_ADMIN_PASSWORD` 改为一个新的临时密码，然后显式执行一次恢复命令：

```bash
docker compose --env-file .env.docker run --rm --no-deps --entrypoint node web /app/web/scripts/bootstrap-admin.mjs --reset
```

该命令只重设 `.env.docker` 中 `INITIAL_ADMIN_USERNAME` 指定账号的密码，不会重建数据库、不执行 Seed，也不会改动其他用户。若使用可选 Secret 配置，则以 Secret 中的密码为准。完成后立即登录并通过界面设置正式密码。

Docker Secret 和 EXE 的配置界面都不能在**数据库完全不可达**时修改登录密码，因为密码哈希保存在 `users` 表中。此时应先恢复 MySQL 的网络、账号权限和数据卷；若数据库已丢失，则按首次部署流程新建数据库并创建新的首次管理员。

默认平台名称为“综合管理平台”。如需改成自己的品牌名称，在 `.env.docker` 中设置 `NUXT_PUBLIC_APP_NAME` 后重启 Web 服务即可：

```text
NUXT_PUBLIC_APP_NAME=你的平台名称
```

## 常用命令

```bash
docker compose --env-file .env.docker logs -f web
docker compose --env-file .env.docker restart web
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d --build
```

数据库文件保存在 `deploy/docker/data/mysql`，上传文件和日志保存在 `deploy/docker/data/app`。镜像不会自动写入演示或业务数据；首次启动完成迁移后只有一个首次管理员，其余业务表保持空白。

修改 `web/` 下的业务源码后，重新执行 `up -d --build` 即可生成新的镜像。

## 使用 GitHub Container Registry 镜像

发布到 GitHub Container Registry 后，把 `.env.docker` 中的 `IT_IMP_IMAGE` 改为：

```text
ghcr.io/<你的 GitHub 用户名>/it-imp-web:v0.0001
```

然后执行：

```bash
docker compose --env-file .env.docker pull web
docker compose --env-file .env.docker up -d --no-build
```

源码构建模式仍使用 `up -d --build`，两种模式共用同一份 `web/` 源码。
