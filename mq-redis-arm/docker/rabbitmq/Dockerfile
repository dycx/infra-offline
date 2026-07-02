# RabbitMQ ARM64 离线镜像
# 构建: docker build -t rabbitmq:3.13-offline .
#
# 需要提前下载:
#   erlang-*-el8-aarch64.rpm       github.com/rabbitmq/erlang-rpm/releases
#   rabbitmq-server-*-el8.noarch.rpm  github.com/rabbitmq/rabbitmq-server/releases
#   socat-*.rpm                    vault.centos.org → AppStream/aarch64

FROM centos:8

# 安装依赖 RPM
COPY erlang-*.rpm /tmp/
COPY socat-*.rpm /tmp/
COPY rabbitmq-server-*.rpm /tmp/

RUN rpm -ivh /tmp/socat-*.rpm 2>/dev/null; \
    rpm -ivh /tmp/erlang-*.rpm 2>&1 || rpm -ivh --nodeps /tmp/erlang-*.rpm; \
    rpm -ivh /tmp/rabbitmq-server-*.rpm 2>&1 || rpm -ivh --nodeps /tmp/rabbitmq-server-*.rpm; \
    rm -f /tmp/*.rpm

# 配置
RUN echo 'listeners.tcp.default = 5672'      > /etc/rabbitmq/rabbitmq.conf && \
    echo 'management.tcp.port = 15672'       >> /etc/rabbitmq/rabbitmq.conf && \
    echo 'management.tcp.ip   = 0.0.0.0'     >> /etc/rabbitmq/rabbitmq.conf && \
    echo 'log.dir = /var/log/rabbitmq'       >> /etc/rabbitmq/rabbitmq.conf && \
    echo 'log.file = rabbitmq.log'           >> /etc/rabbitmq/rabbitmq.conf && \
    echo 'NODENAME=rabbit@localhost'         > /etc/rabbitmq/rabbitmq-env.conf && \
    echo 'NODE_IP_ADDRESS=0.0.0.0'           >> /etc/rabbitmq/rabbitmq-env.conf && \
    mkdir -p /var/log/rabbitmq /var/lib/rabbitmq/mnesia && \
    rabbitmq-plugins enable rabbitmq_management

# 默认账号
ENV RABBITMQ_DEFAULT_USER=admin
ENV RABBITMQ_DEFAULT_PASS=admin123
ENV RABBITMQ_DEFAULT_VHOST=/

VOLUME /var/lib/rabbitmq
EXPOSE 5672 15672

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
