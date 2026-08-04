import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// 公开仓库不预置业务数据，启动时只执行数据库迁移。
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
