# K3s 生产集群 — WSL Ubuntu 部署方案

## 环境

- OS: WSL2 Ubuntu 26.04 (x86_64)
- k3s: v1.36.2+k3s1
- 宿主机: 64 GB RAM, 已分配 32 GB 给 WSL

## 集群架构

```
┌──────────────────────────────────────────────────┐
│ Layer 1  平台          k3s (CoreDNS, Flannel)     │
│ Layer 2  监控          Prometheus + Grafana       │
│ Layer 3  中间件        Redis + RabbitMQ           │
│ Layer 4  管理          K8s Dashboard              │
└──────────────────────────────────────────────────┘
```

## 命名空间

| 命名空间 | 用途 |
|---------|------|
| `monitoring` | Prometheus + Grafana |
| `middleware` | Redis + RabbitMQ |
| `kubernetes-dashboard` | K8s Web UI |
| `kube-system` | k3s 系统组件 |

## 服务列表

| 服务 | 类型 | 内部地址 | 宿主机访问 |
|------|------|---------|-----------|
| Prometheus | ClusterIP | `prometheus:9090` | `http://localhost:9090` |
| Grafana | ClusterIP | `grafana:3000` | `http://localhost:3000` |
| Redis | ClusterIP | `redis:6379` | — |
| RabbitMQ | ClusterIP | `rabbitmq:5672` | `http://localhost:15672` |
| K8s Dashboard | ClusterIP | `kubernetes-dashboard:443` | `https://localhost:8443` |

## 账号密码

| 服务 | 账号 | 密码 |
|------|------|------|
| Grafana | admin | admin123 |
| RabbitMQ | admin | admin123 |
| K8s Dashboard | — | Skip Login（已启用） |

## 快速开始

### 部署

```bash
cd manifests/
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-prometheus-rbac.yaml
kubectl apply -f 02-prometheus-config.yaml
kubectl apply -f 03-prometheus-deploy.yaml
kubectl apply -f 04-grafana.yaml
kubectl apply -f 10-redis.yaml
kubectl apply -f 11-rabbitmq.yaml
kubectl apply -f 20-dashboard.yaml
```

### 端口转发

```bash
bash scripts/port-forward.sh
```

宿主机浏览器即可访问所有界面。

### 内部服务发现

Pod 之间通过 DNS 直连：

```
redis:6379           # Redis
rabbitmq:5672        # RabbitMQ AMQP
rabbitmq:15672       # RabbitMQ 管理
prometheus:9090      # 指标查询
grafana:3000         # 仪表盘
```

## 资源用量

空闲状态（所有服务 Running，无业务负载）：

```
k3s + 全部服务: ~2.1 GB 内存, ~130m CPU
可用余量:      ~29 GB
```

## 文件结构

```
infra-k8s/
├── README.md
├── manifests/
│   ├── 00-namespace.yaml
│   ├── 01-prometheus-rbac.yaml
│   ├── 02-prometheus-config.yaml
│   ├── 03-prometheus-deploy.yaml
│   ├── 04-grafana.yaml
│   ├── 10-redis.yaml
│   ├── 11-rabbitmq.yaml
│   └── 20-dashboard.yaml
└── scripts/
    └── port-forward.sh
```
