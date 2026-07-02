#!/bin/bash
# RabbitMQ 启动脚本 — 首次启动时创建管理员账号

# 后台启动 RabbitMQ
rabbitmq-server -detached

# 等待就绪
for i in $(seq 1 30); do
    rabbitmqctl status &>/dev/null && break
    sleep 2
done

# 创建管理员（幂等）
rabbitmqctl add_user "$RABBITMQ_DEFAULT_USER" "$RABBITMQ_DEFAULT_PASS" 2>/dev/null
rabbitmqctl set_user_tags "$RABBITMQ_DEFAULT_USER" administrator
rabbitmqctl set_permissions -p "$RABBITMQ_DEFAULT_VHOST" "$RABBITMQ_DEFAULT_USER" ".*" ".*" ".*"
rabbitmqctl delete_user guest 2>/dev/null || true

echo "RabbitMQ ready — user: $RABBITMQ_DEFAULT_USER"

# 保持前台运行
tail -f /var/log/rabbitmq/rabbitmq.log
