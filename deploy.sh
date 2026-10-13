#!/usr/bin/env bash
# 云服务器一键部署脚本（在服务器项目根目录执行）
set -e

echo "=== 1. 检查 Docker ==="
docker --version && docker compose version

echo "=== 2. 检查 .env（无则从模板复制） ==="
if [ ! -f .env ]; then
  cp .env.docker.example .env
  echo "已生成 .env，请编辑填写真实值后重新运行本脚本"
  exit 1
fi

echo "=== 3. 构建并启动 ==="
docker compose up -d --build

echo "=== 4. 等待健康检查 ==="
sleep 8
docker compose ps

echo "=== 5. 实时日志（Ctrl+C 退出，服务继续运行） ==="
docker compose logs -f yizhan
