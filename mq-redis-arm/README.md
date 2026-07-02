# ARM 离线环境部署 RabbitMQ + Redis 方案

## 环境

- 架构: ARM64 (aarch64)
- 系统: CentOS 8
- 网络: 完全离线
- 基础镜像: `centos:8`

## 目录结构

```
mq-redis-arm/
├── README.md
├── docker/
│   ├── redis/
│   │   ├── Dockerfile              # 基于 centos:8 + redis RPM
│   │   └── docker-compose.yml
│   └── rabbitmq/
│       ├── Dockerfile              # 基于 centos:8 + erlang + rabbitmq RPM
│       ├── docker-compose.yml
│       └── entrypoint.sh
├── native/
│   ├── install-redis.sh
│   └── install-rabbitmq.sh
└── offline-prep/
    └── prepare-offline.sh
```

---

## 需要准备的 RPM 包

### ARM64 (aarch64)

| 组件 | 下载链接 |
|------|---------|
| **Redis** | `http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages/redis-5.0.3-5.module_el8.4.0+955+7126e393.aarch64.rpm` |
| **socat** | `http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages/socat-1.7.4.1-1.el8.aarch64.rpm` |
| **Erlang** | `https://github.com/rabbitmq/erlang-rpm/releases/download/v26.2.5.3/erlang-26.2.5.3-1.el8.aarch64.rpm` |
| **RabbitMQ** | `https://github.com/rabbitmq/rabbitmq-server/releases/download/v3.13.7/rabbitmq-server-3.13.7-1.el8.noarch.rpm` |

### x86_64（仅在 WSL 验证用）

| 组件 | 下载链接 |
|------|---------|
| **Redis** | `http://vault.centos.org/centos/8/AppStream/x86_64/os/Packages/redis-5.0.3-5.module_el8.4.0+955+7126e393.x86_64.rpm` |
| **socat** | `http://vault.centos.org/centos/8/AppStream/x86_64/os/Packages/socat-1.7.4.1-1.el8.x86_64.rpm` |
| **Erlang** | `https://github.com/rabbitmq/erlang-rpm/releases/download/v26.2.5.3/erlang-26.2.5.3-1.el8.x86_64.rpm` |
| **RabbitMQ** | `https://github.com/rabbitmq/rabbitmq-server/releases/download/v3.13.7/rabbitmq-server-3.13.7-1.el8.noarch.rpm` |

> GitHub 版本号可能更新，404 时请去 releases 页面确认最新文件名。
>
> Redis 还有更新版本可选（5.3.1 / 6.0.9），在 vault 页面自行选择。

---

## 可选依赖

以下依赖缺失时 `--nodeps` 会自动跳过，不影响核心功能：

- `logrotate` — Redis 和 RabbitMQ RPM 声明了此依赖，但不装也能正常运行

---

## 部署步骤

### 第一步：下载 RPM（有网机器）

```bash
mkdir offline-packages && cd offline-packages

# ARM64
curl -LO "http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages/redis-5.0.3-5.module_el8.4.0+955+7126e393.aarch64.rpm"
curl -LO "http://vault.centos.org/centos/8/AppStream/aarch64/os/Packages/socat-1.7.4.1-1.el8.aarch64.rpm"
curl -LO "https://github.com/rabbitmq/erlang-rpm/releases/download/v26.2.5.3/erlang-26.2.5.3-1.el8.aarch64.rpm"
curl -LO "https://github.com/rabbitmq/rabbitmq-server/releases/download/v3.13.7/rabbitmq-server-3.13.7-1.el8.noarch.rpm"
```

### 第二步：拷贝到 ARM 机器

```bash
scp -r mq-redis-arm/ offline-packages/ root@arm-server:/opt/
```

### 第三步：构建并启动

```bash
# Redis
cd /opt/mq-redis-arm/docker/redis/
cp /opt/offline-packages/redis-*.rpm .
docker build -t redis:7-offline .
docker compose up -d

# RabbitMQ
cd /opt/mq-redis-arm/docker/rabbitmq/
cp /opt/offline-packages/{erlang-*,rabbitmq-server-*,socat-*}.rpm .
docker build -t rabbitmq:3.13-offline .
docker compose up -d
```

---

## 环境变量

### Redis (`docker/redis/.env`)

```ini
REDIS_PORT=6379
REDIS_MAXMEMORY=256mb
# REDIS_PASSWORD=***  docker/rabbitmq/.env`)

```ini
RMQ_AMQP_PORT=5672
RMQ_MGMT_PORT=15672
RABBITMQ_USER=admin
RABBITMQ_PASS=admin123
```

---

## 验证

```bash
redis-cli ping                              # → PONG
curl -u admin:admin123 http://localhost:15672/api/overview
```

---

## WSL 验证结果 ✅

当前环境 (x86_64 WSL Ubuntu) 已成功构建并运行：

```
redis:7-offline          364 MB (89.7 MB compressed)
rabbitmq:3.13-offline    556 MB (172 MB compressed)

Redis:   PONG ✅
RabbitMQ: 3.13.7 管理界面正常 ✅
```
