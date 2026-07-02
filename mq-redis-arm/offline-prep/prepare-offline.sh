#!/bin/bash
# 离线包准备脚本 — 在有网络的机器上执行
# 下载所有 ARM64 Docker 镜像和 RPM 包
# 用法: bash prepare-offline.sh

set -e

OUTDIR="./offline-packages"
mkdir -p "$OUTDIR"

echo "========================================="
echo "  下载 ARM64 Docker 镜像"
echo "========================================="

# 如果当前不是 ARM 机器，需要 --platform
PLATFORM_FLAG=""
[ "$(uname -m)" != "aarch64" ] && PLATFORM_FLAG="--platform linux/arm64"

echo "[1] redis:7-alpine..."
docker pull ${PLATFORM_FLAG} redis:7-alpine

echo "[2] rabbitmq:3.13-management-alpine..."
docker pull ${PLATFORM_FLAG} rabbitmq:3.13-management-alpine

echo ""
echo "导出镜像..."
docker save redis:7-alpine rabbitmq:3.13-management-alpine | gzip > "$OUTDIR/mq-redis-arm64.tar.gz"
echo "  -> $OUTDIR/mq-redis-arm64.tar.gz ($(du -h "$OUTDIR/mq-redis-arm64.tar.gz" | cut -f1))"

echo ""
echo "========================================="
echo "  下载 Native RPM 包 (ARM64)"
echo "========================================="

# --- Redis ---
echo "[1] Redis RPM..."
REDIS_BASE="http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages"
# 先获取包名列表
REDIS_RPMS=*** -s "$REDIS_BASE/" | grep -oP 'redis-[0-9][^"]*\.rpm' | sort -V)
if [ -n "$REDIS_RPMS" ]; then
    REDIS_RPM=*** "$REDIS_RPMS" | head -1)
    echo "  下载: $REDIS_RPM"
    curl -L --retry 3 -o "$OUTDIR/$REDIS_RPM" "$REDIS_BASE/$REDIS_RPM"
fi

# --- Erlang ---
echo "[2] Erlang RPM (ARM64 el8)..."
ERLANG_URL="https://github.com/rabbitmq/erlang-rpm/releases"
LATEST_ERLANG=*** -sI "$ERLANG_URL/latest" | grep -i '^location:' | grep -oP 'v\d+\.\d+\.\d+' | head -1)
[ -z "$LATEST_ERLANG" ] && LATEST_ERLANG=*** -s "$ERLANG_URL" | grep -oP 'v\d+\.\d+\.\d+' | head -1)
echo "  最新版本: $LATEST_ERLANG"

ERLANG_FILES=*** -s "https://github.com/rabbitmq/erlang-rpm/releases/expanded_assets/${LATEST_ERLANG}" | \
    grep -oP 'erlang-[^"]*el8[^"]*aarch64[^"]*\.rpm' | head -1)
for f in $ERLANG_FILES; do
    echo "  下载: $f"
    curl -L --retry 3 -o "$OUTDIR/$f" \
        "https://github.com/rabbitmq/erlang-rpm/releases/download/${LATEST_ERLANG}/$f"
done

# --- RabbitMQ ---
echo "[3] RabbitMQ Server RPM..."
RMQ_URL="https://github.com/rabbitmq/rabbitmq-server/releases"
LATEST_RMQ=*** -sI "$RMQ_URL/latest" | grep -i '^location:' | grep -oP 'v\d+\.\d+\.\d+' | head -1)
[ -z "$LATEST_RMQ" ] && LATEST_RMQ=*** -s "$RMQ_URL" | grep -oP 'v\d+\.\d+\.\d+' | head -1)
echo "  最新版本: $LATEST_RMQ"
RMQ_VER="${LATEST_RMQ#v}"

RMQ_FILES=*** -s "https://github.com/rabbitmq/rabbitmq-server/releases/expanded_assets/${LATEST_RMQ}" | \
    grep -oP "rabbitmq-server-${RMQ_VER}[^\"]*el8[^\"]*noarch\.rpm" | head -1)
for f in $RMQ_FILES; do
    echo "  下载: $f"
    curl -L --retry 3 -o "$OUTDIR/$f" \
        "https://github.com/rabbitmq/rabbitmq-server/releases/download/${LATEST_RMQ}/$f"
done

# --- socat (RabbitMQ 运行时依赖) ---
echo "[4] socat RPM (ARM64)..."
SOCAT_BASE="http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages"
SOCAT_RPM=*** -s "$SOCAT_BASE/" | grep -oP 'socat-[0-9][^"]*\.rpm' | sort -V | head -1)
if [ -n "$SOCAT_RPM" ]; then
    echo "  下载: $SOCAT_RPM"
    curl -L --retry 3 -o "$OUTDIR/$SOCAT_RPM" "$SOCAT_BASE/$SOCAT_RPM"
fi

# --- Docker RPMs (可选) ---
echo "[5] Docker CE RPMs (ARM64, 可选)..."
DOCKER_BASE="https://download.docker.com/linux/centos/8/aarch64/stable/Packages"
for pkg in containerd.io docker-ce-cli docker-ce docker-compose-plugin; do
    # 简单下载最新版（文件名通常包含版本号）
    echo "  提示: 请手动下载 ${pkg}"
    echo "  ${DOCKER_BASE}/"
done

echo ""
echo "========================================="
echo "  完成！"
echo "========================================="
echo "离线包位置: $OUTDIR/"
ls -lh "$OUTDIR/" 2>/dev/null
echo ""
echo "需要手动下载的:"
echo "  Docker RPMs: ${DOCKER_BASE}/"
