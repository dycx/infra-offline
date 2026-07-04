# K3s 生产集群 — WSL Ubuntu 部署方案

## 环境

- OS: WSL2 Ubuntu 26.04 (x86_64)
- k3s: v1.36.2+k3s1
- 宿主机: 64 GB RAM, 已分配 32 GB 给 WSL

---

## 集群架构

```
┌──────────────────────────────────────────────────────────┐
│ Layer 1  平台        k3s (CoreDNS, Flannel, containerd)   │
│ Layer 2  监控        Prometheus + Grafana                 │
│ Layer 3  中间件      MySQL + Redis + RabbitMQ             │
│ Layer 4  管理        Kubernetes Dashboard                 │
└──────────────────────────────────────────────────────────┘
```

## 命名空间

| 命名空间 | 用途 |
|---------|------|
| `monitoring` | Prometheus + Grafana |
| `middleware` | MySQL + Redis + RabbitMQ |
| `kubernetes-dashboard` | K8s Web UI |
| `kube-system` | k3s 系统组件 |

## 服务列表

| 服务 | 内部地址 | 宿主机访问 | 账号 |
|------|---------|-----------|------|
| MySQL | `mysql:3306` | `localhost:3306` | root / root123 |
| Redis | `redis:6379` | — | 无密码 |
| RabbitMQ | `rabbitmq:5672` | `http://localhost:15672` | admin / admin123 |
| Prometheus | `prometheus:9090` | `http://localhost:9090` | — |
| Grafana | `grafana:3000` | `http://localhost:3000` | admin / admin123 |
| Dashboard | `kubernetes-dashboard:443` | `https://localhost:8443` | 跳过登录 |

---

## 部署流程

### 1. 安装 k3s

```bash
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="--disable traefik --disable servicelb" sh -
mkdir -p ~/.kube && cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
kubectl get nodes   # 确认 Ready
```

### 2. 部署全部服务

```bash
cd manifests/

# 监控
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-prometheus-rbac.yaml
kubectl apply -f 02-prometheus-config.yaml
kubectl apply -f 03-prometheus-deploy.yaml
kubectl apply -f 04-grafana.yaml

# 中间件
kubectl apply -f 10-redis.yaml
kubectl apply -f 11-rabbitmq.yaml
kubectl apply -f 12-mysql.yaml

# 管理面板
kubectl apply -f 20-dashboard.yaml

# 确认
kubectl get pods -A
```

### 3. 启动端口转发

```bash
bash scripts/port-forward.sh
```

宿主机浏览器访问对应 localhost 端口即可。

---

## 配置管理（ConfigMap 替代 config-service）

### 创建 ConfigMap

```bash
kubectl create configmap user-service-config \
  --from-file=application.yml \
  -n middleware
```

### 在 Deployment 中使用

```yaml
spec:
  containers:
  - name: user-service
    image: user-service:latest
    envFrom:              # 注入为环境变量
    - configMapRef:
        name: user-service-config
    volumeMounts:          # 或挂载为文件
    - name: config
      mountPath: /app/config
  volumes:
  - name: config
    configMap:
      name: user-service-config
```

### 配置热刷新

```bash
# 安装 Reloader
kubectl apply -f https://github.com/stakater/Reloader/releases/latest/download/reloader.yaml
```

Deployment 加注解后，ConfigMap 变更自动滚动重启 Pod：

```yaml
metadata:
  annotations:
    reloader.stakater.com/auto: "true"
```

---

## 服务发现

集群内通过 DNS 直连，不需要 Eureka/Consul：

```
mysql:3306        # MySQL
redis:6379        # Redis
rabbitmq:5672     # RabbitMQ AMQP
prometheus:9090   # 指标查询
grafana:3000      # 仪表盘
```

---

## 资源用量

空闲状态（所有服务 Running，无业务负载）：

```
k3s + 全部服务: ~2.5 GB 内存, ~150m CPU
可用余量:      ~29 GB
```

---

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
│   ├── 12-mysql.yaml
│   └── 20-dashboard.yaml
└── scripts/
    └── port-forward.sh
```

---

## 常用命令

```bash
kubectl get pods -A                          # 查看所有 Pod
kubectl logs -f deployment/mysql -n middleware  # 查看日志
kubectl rollout restart deployment/mysql    # 重启服务
kubectl exec -it deployment/mysql -n middleware -- mysql -uroot -p  # 进入 MySQL
```
