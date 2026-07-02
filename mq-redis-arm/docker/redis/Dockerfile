# Redis ARM64 离线镜像
# 构建: docker build -t redis:7-offline .
#
# 需要提前下载并放在同目录:
#   redis-*.rpm    从 vault.centos.org → AppStream/aarch64

FROM centos:8

COPY redis-*.rpm /tmp/

# 安装 RPM（容忍依赖警告）
RUN rpm -ivh /tmp/redis-*.rpm 2>&1 || rpm -ivh --nodeps /tmp/redis-*.rpm; \
    rm -f /tmp/*.rpm

# 配置
RUN mkdir -p /data /var/log/redis && \
    echo 'bind 0.0.0.0'           > /etc/redis.conf && \
    echo 'port 6379'              >> /etc/redis.conf && \
    echo 'daemonize no'           >> /etc/redis.conf && \
    echo 'dir /data'              >> /etc/redis.conf && \
    echo 'appendonly yes'         >> /etc/redis.conf && \
    echo 'maxmemory 256mb'        >> /etc/redis.conf && \
    echo 'maxmemory-policy allkeys-lru' >> /etc/redis.conf

VOLUME /data
EXPOSE 6379

CMD ["redis-server", "/etc/redis.conf"]
