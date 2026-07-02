#!/bin/bash
# Redis 离线安装脚本 (CentOS 8 ARM64)
# 用法: bash install-redis.sh

set -e

# ============================================
# 环境变量 (修改此处)
# ============================================
REDIS_PORT=6379
REDIS_BIND="0.0.0.0"
REDIS_MAXMEMORY="256mb"
REDIS_MAXMEMORY_POLICY="allkeys-lru"
# REDIS_PASSWORD=""            # 留空 = 无密码
# ============================================

REDIS_RPM=*** redis-*.rpm 2>/dev/null || echo "")

if [ -z "$REDIS_RPM" ]; then
    echo "错误: 找不到 redis RPM 包"
    echo ""
    echo "下载地址:"
    echo "  http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages/"
    echo "  搜索 redis-5.0.3-*.rpm 或更高版本"
    exit 1
fi

echo "=== 检查依赖 ==="
# Redis RPM 可能依赖 jemalloc，尝试安装
for dep_rpm in jemalloc-*.rpm; do
    [ -f "$dep_rpm" ] && rpm -ivh "$dep_rpm" 2>/dev/null && echo "  已安装: $dep_rpm"
done

echo "=== 安装 $REDIS_RPM ==="
rpm -ivh "$REDIS_RPM" 2>&1 || {
    echo "  提示: 尝试 --nodeps 安装"
    rpm -ivh --nodeps "$REDIS_RPM"
}

echo "=== 配置 Redis ==="
mkdir -p /etc/redis /var/log/redis /var/lib/redis

cat > /etc/redis/redis.conf << EOF
bind ${REDIS_BIND}
port ${REDIS_PORT}
daemonize no
supervised systemd
pidfile /var/run/redis_6379.pid
logfile /var/log/redis/redis.log
dir /var/lib/redis
appendonly yes
maxmemory ${REDIS_MAXMEMORY}
maxmemory-policy ${REDIS_MAXMEMORY_POLICY}
EOF

# 如果设置了密码
if [ -n "$REDIS_PASSWORD" ]; then
    echo "requirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf
fi

echo "=== 创建 systemd 服务 ==="
cat > /etc/systemd/system/redis.service << 'SVC'
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
Type=notify
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/bin/redis-cli shutdown
Restart=always
User=redis
Group=redis
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
SVC

echo "=== 启动 Redis ==="
systemctl daemon-reload
systemctl enable redis
systemctl start redis

echo "=== 验证 ==="
sleep 1
redis-cli ping

echo ""
echo "Redis 安装完成！"
echo "  端口: ${REDIS_PORT}"
echo "  配置: /etc/redis/redis.conf"
echo "  日志: /var/log/redis/redis.log"
echo "  状态: systemctl status redis"
echo "  停止: systemctl stop redis"
