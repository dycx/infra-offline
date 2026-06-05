# TuGraph Deploy

TuGraph DB 离线部署 + K8s 集成方案。

## 仓库结构

```
tugraph-deploy/
├── offline/                              # 离线部署 (CentOS 7 无网络环境)
│   ├── download.sh                       # 在有网机器上下载 RPM 包
│   ├── install.sh                        # 离线一键安装脚本
│   └── README.txt                        # 离线部署详细文档
│
├── k8s/                                  # Kubernetes 部署清单
│   ├── tugraph-infra.yaml                # Secret + ConfigMap + Service + Endpoints
│   └── demo-service.yaml                 # Demo 服务 Deployment
│
├── tugraph-spring-boot-starter/          # Spring Boot Starter（自动认证注入）
│   ├── pom.xml
│   └── src/main/java/com/tugraph/starter/
│       ├── TuGraphAutoConfiguration.java
│       ├── TuGraphProperties.java
│       └── TuGraphClient.java
│
└── demo-service/                         # 使用 Starter 的示例服务
    ├── pom.xml
    └── src/main/java/com/example/demo/
        ├── DemoApplication.java
        └── controller/GraphController.java
```

## 快速开始

### 离线部署 TuGraph (CentOS 7)

```bash
# 在联网机器上
cd offline
./download.sh                  # 下载所有 RPM 包
tar czf tugraph-offline.tar.gz tugraph-offline/

# 传输到目标 CentOS 7 机器
cd tugraph-offline
sudo ./install.sh              # 一键安装
```

### K8s 集成

```bash
# 部署 TuGraph 基础设施
kubectl apply -f k8s/tugraph-infra.yaml

# 构建 Starter
cd tugraph-spring-boot-starter
mvn clean install -DskipTests

# 在你的 Spring Boot 项目中使用
# pom.xml:
#   <dependency>
#     <groupId>com.tugraph</groupId>
#     <artifactId>tugraph-spring-boot-starter</artifactId>
#     <version>1.0.0</version>
#   </dependency>

# 代码中直接注入:
@Autowired
private TuGraphClient tugraph;

List<Map<String, Object>> rows = tugraph.callCypher("MATCH (n) RETURN n LIMIT 10");
```

## Starter 特性

| 特性 | 说明 |
|------|------|
| 零侵入 | 不需要写 login / refresh token 代码 |
| 自动认证 | 首次调用自动 POST `/login` 获取 JWT |
| Token 缓存 | 缓存 JWT，过期前自动刷新 |
| 失败重试 | 网络错误自动重试（可配置） |
| K8s 友好 | 配置全部通过环境变量 / ConfigMap / Secret 注入 |

## 依赖

- **离线部署**: CentOS 7 x86_64, glibc >= 2.17
- **Spring Boot Starter**: Java 21+, Spring Boot 3.3+
- **K8s**: Kubernetes 1.20+

## 许可

Apache-2.0
