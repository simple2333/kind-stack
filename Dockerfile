# ============================================================
# 益栈 Docker 镜像（多阶段构建）
# 用 node:22-slim(Debian) 而非 alpine：better-sqlite3 有预编译二进制，
# 免去现场装 g++/make/python 编译（alpine 无预编译，需现场编译极慢）。
# 全程用国内 npm 镜像加速依赖安装。
# ============================================================

# ---- 阶段 1：依赖 + 构建 ----
FROM node:22-slim AS builder

WORKDIR /app
# 国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

# 先拷贝依赖清单，利用层缓存
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NODE_ENV=production \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN npm run build

# ---- 阶段 2：运行 ----
FROM node:22-slim AS runner

WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com
ENV NODE_ENV=production

# 生产依赖 + 首次初始化所需 CLI（drizzle-kit 建表 / tsx 跑 seed / dotenv）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm i --no-save drizzle-kit@0.31.10 tsx@4.23.12 dotenv@17.4.2

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/drizzle ./drizzle 2>/dev/null || true

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && mkdir -p /app/data

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/ || exit 1

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]
