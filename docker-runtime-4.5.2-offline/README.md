# TuGraph 4.5.2 离线 Docker 镜像

基于 Rocky Linux 8，纯 C++ 内核，不含 JDK/Python。REST API + Cypher 查询正常运行。

## 文件清单

```
tugraph-docker/
├── Dockerfile                                # 构建文件
├── tugraph-4.5.2-1.el8.x86_64.rpm            # TuGraph RPM (44.8 MB)
├── libquadmath-8.5.0-22.el8_10.x86_64.rpm    # libvsag 依赖 (171 KB)
├── libgfortran-8.5.0-22.el8_10.x86_64.rpm    # libvsag 依赖 (644 KB)
├── libgomp-8.5.0-22.el8_10.x86_64.rpm        # libvsag 依赖 (207 KB)
├── README.md
└── export/
    └── tugraph-4.5.2-offline.tar.gz           # 预构建镜像 (177 MB)
```

## 方式一：直接导入预构建镜像（最快）

目标机器上只需要 Docker，不需要任何网络：

```bash
# 1. 导入镜像
docker load < tugraph-4.5.2-offline.tar.gz

# 2. 启动
mkdir -p /data/tugraph/{data,log}
docker run -d --name tugraph \
  -p 7070:7070 -p 9090:9090 \
  -v /data/tugraph/data:/var/lib/lgraph/data \
  -v /data/tugraph/log:/var/log/lgraph_log \
  tugraph:4.5.2-offline

# 3. 验证
curl http://localhost:7070/info
```

## 方式二：从 Dockerfile 重新构建

如果需要在其他基础镜像上构建，或修改配置：

```bash
# 确保四个 RPM 包在同一目录
cd tugraph-docker/
docker build -t tugraph:4.5.2-offline .
docker run -d --name tugraph \
  -p 7070:7070 -p 9090:9090 \
  -v /data/tugraph/data:/var/lib/lgraph/data \
  -v /data/tugraph/log:/var/log/lgraph_log \
  tugraph:4.5.2-offline
```

## 默认配置

| 项 | 值 |
|----|-----|
| 账号 | admin |
| 密码 | 73@TuGraph |
| REST 端口 | 7070 |
| RPC 端口 | 9090 |
| 数据目录 | /var/lib/lgraph/data |
| 日志目录 | /var/log/lgraph_log |

## REST API 速查

```bash
# 登录
curl -X POST http://localhost:7070/login \
  -H 'Content-Type: application/json' \
  -d '{"user":"admin","password":"73@TuGraph"}'
# 返回 {"jwt":"<token>"}

# 创建标签
curl -X POST http://localhost:7070/cypher \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"graph":"default","script":"CALL db.createVertexLabel(...)"}'

# Cypher 查询
curl -X POST http://localhost:7070/cypher \
  -H 'Authorization: Bearer <token>' \
  -H 'Content-Type: application/json' \
  -d '{"graph":"default","script":"MATCH (n) RETURN n LIMIT 10"}'

# 服务器信息
curl http://localhost:7070/info -H 'Authorization: Bearer <token>'
```

## 已有镜像的机器间迁移

```bash
# 导出
docker save tugraph:4.5.2-offline | gzip > tugraph-4.5.2-offline.tar.gz

# 拷贝到目标机器后导入
docker load < tugraph-4.5.2-offline.tar.gz
```

## 自定义配置

挂载自定义配置文件：

```bash
docker run -d --name tugraph \
  -p 7070:7070 -p 9090:9090 \
  -v /path/to/lgraph.json:/usr/local/etc/lgraph.json \
  -v /data/tugraph/data:/var/lib/lgraph/data \
  -v /data/tugraph/log:/var/log/lgraph_log \
  tugraph:4.5.2-offline
```
