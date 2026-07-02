#!/bin/bash
# RabbitMQ 离线安装脚本 (CentOS 8 ARM64)
# 用法: bash install-rabbitmq.sh
#
# 离线 RPM 下载地址:
#   Erlang:   https://github.com/rabbitmq/erlang-rpm/releases  (el8-aarch64)
#   RabbitMQ: https://github.com/rabbitmq/rabbitmq-server/releases (el8 noarch)
#   socat:    yumdownloader --resolve socat  (RabbitMQ 运行时依赖)

set -e

# ============================================
# 环境变量 (修改此处)
# ============================================
RMQ_ADMIN_USER="admin"
RMQ_ADMIN_PASS="admin123"
RMQ_VHOST="/"
# ============================================

ERLANG_RPM=*** erlang-*.rpm 2>/dev/null || echo "")
RMQ_RPM=*** rabbitmq-server-*.rpm 2>/dev/null || echo "")

# 检查 RPM
missing=""
[ -z "$ERLANG_RPM" ] && missing="$missing erlang-*.rpm"
[ -z "$RMQ_RPM" ]    && missing="$missing rabbitmq-server-*.rpm"

if [ -n "$missing" ]; then
    echo "错误: 缺少 RPM 包: $missing"
    echo ""
    echo "下载地址:"
    echo "  Erlang:   https://github.com/rabbitmq/erlang-rpm/releases"
    echo "            → 选择 el8-aarch64 版本"
    echo "  RabbitMQ: https://github.com/rabbitmq/rabbitmq-server/releases"
    echo "            → 选择 el8 noarch 版本"
    exit 1
fi

echo "=== 安装系统依赖 ==="
# socat — RabbitMQ 运行时需要
# ncurses, openssl — Erlang 运行时需要 (通常系统自带)
echo "  检查 socat..."
if ! command -v socat &>/dev/null; then
    SOCAT_RPM=*** socat-*.rpm 2>/dev/null || echo "")
    if [ -n "$SOCAT_RPM" ]; then
        rpm -ivh "$SOCAT_RPM" || echo "  socat 安装失败，继续..."
    else
        echo "  警告: socat 未安装且未提供 RPM，RabbitMQ 可能报错"
    fi
else
    echo "  socat 已安装"
fi

echo "=== 安装 Erlang ==="
rpm -ivh "$ERLANG_RPM" 2>&1 || {
    echo "  依赖不满足，尝试 --nodeps..."
    rpm -ivh --nodeps "$ERLANG_RPM"
}
echo "  Erlang 版本: $(erl -eval 'erlang:display(erlang:system_info(otp_release)), halt().' -noshell 2>/dev/null || echo '检查失败')"

echo "=== 安装 RabbitMQ ==="
rpm -ivh "$RMQ_RPM" 2>&1 || {
    echo "  依赖不满足，尝试 --nodeps..."
    rpm -ivh --nodeps "$RMQ_RPM"
}

echo "=== 配置 ==="
cat > /etc/rabbitmq/rabbitmq.conf << 'EOF'
listeners.tcp.default = 5672
management.tcp.port = 15672
management.tcp.ip   = 0.0.0.0
log.dir = /var/log/rabbitmq
log.file = rabbitmq.log
EOF

# 环境变量文件
cat > /etc/rabbitmq/rabbitmq-env.conf << EOF
NODENAME=rabbit@localhost
NODE_IP_ADDRESS=0.0.0.0
NODE_PORT=5672
EOF

mkdir -p /var/log/rabbitmq /var/lib/rabbitmq/mnesia

echo "=== 启动 ==="
systemctl enable rabbitmq-server
systemctl start rabbitmq-server

# 等待 RabbitMQ 完全启动
echo "  等待 RabbitMQ 启动..."
for i in $(seq 1 30); do
    if rabbitmqctl status &>/dev/null; then
        break
    fi
    sleep 2
done

echo "=== 创建管理员账号 ==="
rabbitmqctl add_user "$RMQ_ADMIN_USER" "$RMQ_ADMIN_PASS" 2>/dev/null || echo "  用户 $RMQ_ADMIN_USER 已存在"
rabbitmqctl set_user_tags "$RMQ_ADMIN_USER" administrator
rabbitmqctl set_permissions -p "$RMQ_VHOST" "$RMQ_ADMIN_USER" ".*" ".*" ".*"

# 删除默认 guest 用户
rabbitmqctl delete_user guest 2>/dev/null || true

echo "=== 启用管理插件 ==="
rabbitmq-plugins enable rabbitmq_management

echo ""
echo "========================================"
echo "  RabbitMQ 安装完成！"
echo "========================================"
echo "  管理界面: http://<IP>:15672"
echo "  账号: ${RMQ_ADMIN_USER} / ${RMQ_ADMIN_PASS}"
echo "  AMQP:    <IP>:5672"
echo ""
echo "  管理命令:"
echo "    状态:   systemctl status rabbitmq-server"
echo "    队列:   rabbitmqctl list_queues"
echo "    连接:   rabbitmqctl list_connections"
echo "========================================"
