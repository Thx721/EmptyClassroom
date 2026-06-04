#!/bin/bash
# 阿里云服务器 → 北邮教务 连通性测试
# 用法: curl -sL https://raw.githubusercontent.com/.../probe.sh | bash
# 或者: bash probe.sh

echo "=========================================="
echo "  阿里云 → 北邮教务 连通性探针"
echo "  时间: $(TZ='Asia/Shanghai' date 2>/dev/null || date)"
echo "=========================================="
echo ""

# ─── Test 1: DNS 解析 ───
echo "【1/4】DNS 解析测试..."

echo -n "  IPv4: "
v4=$(getent hosts jwglweixin.bupt.edu.cn 2>/dev/null | grep -v ':' | awk '{print $1}' | head -1)
if [ -n "$v4" ]; then
  echo "✅ $v4"
else
  echo "❌ 解析失败 / 无 IPv4 记录"
fi

echo -n "  IPv6: "
v6=$(getent hosts jwglweixin.bupt.edu.cn 2>/dev/null | grep ':' | awk '{print $1}' | head -1)
if [ -n "$v6" ]; then
  echo "✅ $v6"
else
  echo "❌ 解析失败 / 无 IPv6 记录"
fi

echo ""

# ─── Test 2: HTTP 登录接口 ───
echo "【2/4】HTTP 连接测试（域名直连）..."

HTTP_INFO=$(curl -s -o /tmp/probe_body.txt -w "HTTP:%{http_code} TIME:%{time_total}s" \
  --connect-timeout 10 --max-time 15 \
  -X POST "http://jwglweixin.bupt.edu.cn/bjyddx/login" 2>&1)
HTTP_CODE=$(echo "$HTTP_INFO" | grep -oP 'HTTP:\K[0-9]+')
BODY=$(cat /tmp/probe_body.txt 2>/dev/null)

echo "  状态码: $HTTP_CODE"
echo "  响应:   ${BODY:0:300}"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
  echo "  ✅ HTTP 连接成功（服务器可达）"
elif [ -z "$HTTP_CODE" ] || [ "$HTTP_CODE" = "000" ]; then
  echo "  ❌ 无法连接（超时/拒绝/路由不可达）"
else
  echo "  ⚠️  状态码 $HTTP_CODE"
fi

echo ""

# ─── Test 3: IPv6 直连 ───
echo "【3/4】IPv6 直连测试..."

HTTP_INFO6=$(curl -s -o /tmp/probe_body_v6.txt -w "HTTP:%{http_code} TIME:%{time_total}s" \
  --connect-timeout 10 --max-time 15 \
  -H "Host: jwglweixin.bupt.edu.cn" \
  "http://[2001:da8:215:4038::161]/bjyddx/login" 2>&1)
HTTP_CODE6=$(echo "$HTTP_INFO6" | grep -oP 'HTTP:\K[0-9]+')
BODY6=$(cat /tmp/probe_body_v6.txt 2>/dev/null)

echo "  状态码: $HTTP_CODE6"
echo "  响应:   ${BODY6:0:300}"
echo ""

if [ "$HTTP_CODE6" = "200" ] || [ "$HTTP_CODE6" = "500" ]; then
  echo "  ✅ IPv6 直连成功"
elif [ -z "$HTTP_CODE6" ] || [ "$HTTP_CODE6" = "000" ]; then
  echo "  ❌ IPv6 直连失败"
else
  echo "  ⚠️  状态码 $HTTP_CODE6"
fi

echo ""

# ─── Test 4: 网络诊断 ───
echo "【4/4】网络诊断..."

echo -n "  本机出口 IPv4: "
curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "N/A"

echo -n "  本机出口 IPv6: "
curl -s --connect-timeout 5 ifconfig.me 2>/dev/null || echo "N/A"

echo -n "  DNS 服务器: "
grep 'nameserver' /etc/resolv.conf 2>/dev/null | awk '{print $2}' | tr '\n' ' '
echo ""

echo ""
echo "=========================================="
echo "  测试完成"
echo "=========================================="
