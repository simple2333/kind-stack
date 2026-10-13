#!/bin/sh
set -e

echo "[entrypoint] 数据库初始化..."
# 首次启动建表 + 种子（幂等：已存在会跳过）
# --force 跳过 drizzle-kit 的非交互确认提示
npx drizzle-kit push --force
npm run db:seed

echo "[entrypoint] 启动 Next.js 生产服务..."
exec npm start
