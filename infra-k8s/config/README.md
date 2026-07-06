# ConfigMap 配置管理

## 用法

原有 `config-service` + `application.properties` 替换为 K8s ConfigMap。

**代码改动：零**。`@Value`、`@ConfigurationProperties` 全部不变。

只需：
1. 创建 ConfigMap（从现有 properties 文件）
2. Deployment 加一行 `spring.config.import` + 一个 volume

## 示例

### 创建 ConfigMap

```bash
kubectl apply -f manifests/30-config-example.yaml
```

### Deployment 中引用

```yaml
spec:
  containers:
  - name: app
    env:
    - name: SPRING_CONFIG_IMPORT
      value: "configtree:/etc/config/"
    volumeMounts:
    - name: config
      mountPath: /etc/config
  volumes:
  - name: config
    configMap:
      name: user-service-config
```

### 原理

```
/etc/config/redis.host  → 内容 "redis"     → @Value("${redis.host}")
/etc/config/redis.port  → 内容 "6379"      → @Value("${redis.port}")
/etc/config/mysql.host  → 内容 "mysql"     → @Value("${mysql.host}")
```

Spring Boot 2.4+ 的 `configtree` 导入器自动完成映射。

### 配置热刷新

```bash
kubectl apply -f manifests/30-config-example.yaml   # 更新 ConfigMap
kubectl rollout restart deployment/user-service    # 重启 Pod 生效
```

或安装 Reloader 实现自动重启。
