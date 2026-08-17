# web — IT_IMP 业务源码（Nuxt + Prisma）

本目录是 IT_IMP 唯一的业务源码，同时供 Docker 镜像与 Windows EXE 两种部署方式使用。桌面端（`desktop/`）与 Docker（`deploy/docker/`）不复制业务代码，均从这里的构建产物运行。

## 技术栈

- [Nuxt 4](https://nuxt.com/docs/getting-started/introduction)（Vue 3 + Nitro 服务端路由）
- [Prisma ORM](https://www.prisma.io/docs)（MySQL 8.0 / MariaDB）
- Element Plus 组件库，橙色主题设计令牌（CSS 变量）
- Vitest 单元测试

## 环境要求

- Node.js 24+
- 可访问的 MySQL 8.0 / MariaDB 数据库（通过 `DATABASE_URL` 环境变量或 `.env` 提供，参考 `.env.example`）

## 常用命令

```bash
# 按锁文件安装依赖（可复现构建，不要用 npm install）
npm ci

# 生成 Prisma Client（install / 测试 / 构建前需要）
npx prisma generate

# 开发服务器（默认 http://localhost:3000）
npm run dev

# 类型检查
npm run typecheck

# 单元测试
npm test

# 生产构建（输出到 .output/）
npm run build

# 本地预览生产构建
npm run preview
```

## 目录结构

```text
app/              前端页面、组件、布局与 composables
server/           Nitro 服务端（API 路由、中间件、工具函数）
prisma/           Prisma schema 与迁移
scripts/          运维/演示/截图脚本（凭据一律经环境变量传入，见各脚本头部说明）
generated/        prisma generate 的客户端产物（不入库）
```

## 数据库

- Schema 位于 `prisma/schema.prisma`，修改后执行 `npx prisma generate` 同步客户端；
- 迁移由桌面端配置工具或部署脚本执行，本目录不内置业务 Seed；
- 首个管理员由 `scripts/bootstrap-admin.mjs` 在空用户表时创建。

## 测试与脚本约定

- API 测试位于各路由旁的 `*.spec.ts`，运行 `npm test`；
- 演示/清理脚本（如 `demo-topology-data.cjs`、`clean-topology-demo.cjs`）需要显式传入 `BASE_URL` 与凭据环境变量（`ADMIN_TOKEN` 或 `ADMIN_USERNAME` / `ADMIN_PASSWORD`），缺失时直接报错退出，不内置任何默认凭据。

更多整体信息见[项目根目录 README](../README.md)。
