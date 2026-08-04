import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// SEED_MODE=demo 浣跨敤铏氭嫙婕旂ず鏁版嵁锛堝叕寮€浠撳簱榛樿锛?
// SEED_MODE=internal 浣跨敤鍐呴儴鐪熷疄鏁版嵁锛堢鏈夐儴缃诧級
// 鏈缃椂榛樿 internal
const seedFile = process.env.SEED_MODE === 'demo' ? 'seed.demo.ts' : 'seed.ts'

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: `node --import tsx prisma/${seedFile}`,
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
