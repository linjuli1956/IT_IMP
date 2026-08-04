# IT_IMP Docker 多阶段构建
# 构建上下文：项目根目录 IT_IMP/

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS builder

WORKDIR /app/web

# 先复制依赖清单，尽量复用 Docker 层缓存
COPY web/package.json web/package-lock.json ./
RUN npm ci

# 复制唯一业务源码
COPY web/ ./

# Prisma generate 只需要合法的连接串，不会在构建阶段连接数据库
ENV DATABASE_URL="mysql://root:placeholder@localhost:3306/it_imp"

RUN npx prisma generate \
    && npx nuxt build

FROM ${NODE_IMAGE} AS runtime

WORKDIR /app/web

COPY --from=builder /app/web/.output ./.output
COPY --from=builder /app/web/generated ./generated
COPY --from=builder /app/web/node_modules ./node_modules
COPY --from=builder /app/web/package.json ./package.json
COPY --from=builder /app/web/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/web/prisma ./prisma
COPY --from=builder /app/web/scripts ./scripts

RUN mkdir -p \
    /app/data/uploads/invoices \
    /app/data/uploads/details \
    /app/data/uploads/contracts \
    /app/data/logs

COPY deploy/docker/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
