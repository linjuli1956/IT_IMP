# IT_IMP Docker 部署

Docker 配置属于主项目的一部分，构建时直接使用 `../../web`，不再维护第二份源码。

## 首次启动

Windows PowerShell：

```powershell
cd C:\lsg\IT_IMP_V0.0001\IT_IMP\deploy\docker
Copy-Item .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

Linux：

```bash
cd /path/to/IT_IMP/deploy/docker
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

访问地址默认为 `http://localhost:3000`。

## 常用命令

```bash
docker compose --env-file .env.docker logs -f web
docker compose --env-file .env.docker restart web
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d --build
```

数据库文件保存在 `deploy/docker/data/mysql`，上传文件和日志保存在 `deploy/docker/data/app`。

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
