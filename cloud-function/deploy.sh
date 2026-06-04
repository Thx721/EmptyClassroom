#!/bin/bash
# 教务 Relay 一键部署 — 阿里云 ECS
# 用法: bash deploy.sh <你的secret密码>

set -e

SECRET="${1:-emptyclassroom}"
RELAY_DIR="/opt/relay"
SERVICE_NAME="jw-relay"

echo "=== 安装 Node.js ==="
command -v node || (apt update -qq && apt install -y -qq nodejs npm)

echo "=== 创建 relay 目录 ==="
mkdir -p "$RELAY_DIR"

echo "=== 下载 relay.js ==="
curl -sL "https://raw.githubusercontent.com/Thx721/EmptyClassroom/main/cloud-function/relay.js" -o "$RELAY_DIR/relay.js"

echo "=== 配置 systemd 服务 ==="
cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=JWGL Relay Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$RELAY_DIR
Environment=PORT=3000
Environment=RELAY_SECRET=$SECRET
ExecStart=/usr/bin/node $RELAY_DIR/relay.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 2
echo ""
echo "=== 检查状态 ==="
systemctl status "$SERVICE_NAME" --no-pager | head -10
echo ""
echo "=== 测试 ==="
sleep 1
curl -s "http://localhost:3000/health" && echo ""
echo ""
echo "=== 部署完成 ==="
echo "Relay 地址: http://$(hostname -I | awk '{print $1}'):3000"
echo "Secret:     $SECRET"
