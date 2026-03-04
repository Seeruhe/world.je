# 部署拓扑与扩容策略

> 版本: 1.0.0 | 更新时间: 2026-03-05

---

## 1. 部署架构总览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            入口层 (Ingress)                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │   Traefik   │  │  WebSocket  │  │    CDN      │                          │
│  │   (HTTP)    │  │  Gateway    │  │  (静态资源)  │                          │
│  └──────┬──────┘  └──────┬──────┘  └─────────────┘                          │
└─────────┼────────────────┼───────────────────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            服务层 (Services)                                 │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    Play     │  │    Back     │  │ Map-Storage │  │  Uploader   │        │
│  │  (Frontend) │  │   (gRPC)    │  │   (Maps)    │  │  (Upload)   │        │
│  │  Replicas: 3│  │  Replicas: 3│  │  Replicas: 2│  │  Replicas: 1│        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │  OpenClaw   │  │   MCP       │  │   Policy    │                          │
│  │  Gateway    │  │  Gateway    │  │   Engine    │                          │
│  │  Replicas: 2│  │  Replicas: 2│  │  Replicas: 2│                          │
│  └─────────────┘  └─────────────┘  └─────────────┘                          │
└─────────────────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            数据层 (Data)                                     │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  PostgreSQL │  │    Redis    │  │   Kafka     │  │     S3      │        │
│  │   (主数据库) │  │  (缓存/状态) │  │  (事件流)   │  │  (对象存储)  │        │
│  │  Primary+RR │  │   Cluster   │  │   Cluster   │  │  MinIO/云   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Kubernetes 部署配置

### 2.1 Namespace 结构

```yaml
# namespaces.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: world-platform
  labels:
    environment: production
---
apiVersion: v1
kind: Namespace
metadata:
  name: world-platform-staging
  labels:
    environment: staging
```

### 2.2 Play 服务 Deployment

```yaml
# deployments/play-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: play
  namespace: world-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: play
  template:
    metadata:
      labels:
        app: play
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
    spec:
      containers:
        - name: play
          image: workadventure/play:latest
          ports:
            - containerPort: 3000
              name: http
            - containerPort: 3001
              name: ws
          resources:
            requests:
              cpu: 100m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          env:
            - name: API_URL
              value: "back:50051"
            - name: NODE_ENV
              value: "production"
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: play
                topologyKey: kubernetes.io/hostname
```

### 2.3 Back 服务 Deployment (gRPC)

```yaml
# deployments/back-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: back
  namespace: world-platform
spec:
  replicas: 3
  selector:
    matchLabels:
      app: back
  template:
    metadata:
      labels:
        app: back
    spec:
      containers:
        - name: back
          image: workadventure/back:latest
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 50051
              name: grpc
          resources:
            requests:
              cpu: 200m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: url
            - name: KAFKA_BROKERS
              value: "kafka-0.kafka:9092,kafka-1.kafka:9092,kafka-2.kafka:9092"
```

### 2.4 OpenClaw Gateway Deployment

```yaml
# deployments/openclaw-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: openclaw-gateway
  namespace: world-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: openclaw-gateway
  template:
    metadata:
      labels:
        app: openclaw-gateway
    spec:
      containers:
        - name: gateway
          image: workadventure/openclaw-gateway:latest
          ports:
            - containerPort: 18789
              name: ws
            - containerPort: 18790
              name: http
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          env:
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: llm-credentials
                  key: anthropic-key
            - name: OPENCLAW_DEFAULT_MODEL
              value: "glm-5"
            - name: MCP_GATEWAY_URL
              value: "http://mcp-gateway:8080"
```

---

## 3. HPA (Horizontal Pod Autoscaler) 配置

### 3.1 Play HPA

```yaml
# hpa/play-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: play-hpa
  namespace: world-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: play
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    - type: Pods
      pods:
        metric:
          name: websocket_connections
        target:
          type: AverageValue
          averageValue: "1000"  # 每个 Pod 最多 1000 连接
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
        - type: Pods
          value: 4
          periodSeconds: 15
      selectPolicy: Max
```

### 3.2 Back HPA

```yaml
# hpa/back-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: back-hpa
  namespace: world-platform
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: back
  minReplicas: 3
  maxReplicas: 50
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Pods
      pods:
        metric:
          name: grpc_requests_per_second
        target:
          type: AverageValue
          averageValue: "500"
```

---

## 4. 房间分片策略

### 4.1 分片规则

```yaml
# config/sharding.yaml
sharding:
  # 分片数量
  totalShards: 16

  # 分片算法
  algorithm: consistent-hash

  # 分片映射
  shardMapping:
    # 热点房间专用分片
    hot:
      shards: [0, 1, 2, 3]
      criteria:
        concurrentUsers: 100
      strategy: instance

    # 普通房间分片
    normal:
      shards: [4, 5, 6, 7, 8, 9, 10, 11]
      strategy: hash

    # 私密房间分片
    private:
      shards: [12, 13, 14, 15]
      strategy: dedicated

  # 实例化配置
  instancing:
    # 自动实例化阈值
    autoInstanceThreshold: 40

    # 实例命名规则
    namingPattern: "{roomId}#{instanceNum}"

    # 实例最大数量
    maxInstancesPerRoom: 10

    # 实例合并条件
    mergeThreshold: 10
    mergeDelay: 300  # 秒
```

### 4.2 分片路由服务

```yaml
# deployments/shard-router.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: shard-router
  namespace: world-platform
spec:
  replicas: 2
  selector:
    matchLabels:
      app: shard-router
  template:
    metadata:
      labels:
        app: shard-router
    spec:
      containers:
        - name: router
          image: workadventure/shard-router:latest
          ports:
            - containerPort: 8080
          env:
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: SHARD_CONFIG_PATH
              value: /config/sharding.yaml
```

---

## 5. 数据层配置

### 5.1 PostgreSQL (主数据库)

```yaml
# postgres/postgres.yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgresql
  namespace: world-platform
spec:
  instances: 3
  primaryUpdateStrategy: unsupervised

  storage:
    size: 100Gi
    storageClass: fast-ssd

  resources:
    requests:
      cpu: 500m
      memory: 2Gi
    limits:
      cpu: 2000m
      memory: 8Gi

  backup:
    barmanObjectStore:
      destinationPath: s3://world-platform-backups/postgres
      s3Credentials:
        accessKeyId:
          name: backup-credentials
          key: access-key
        secretAccessKey:
          name: backup-credentials
          key: secret-key
    retentionPolicy: "30d"

  # 读写分离
  postgresql:
    parameters:
      max_connections: "500"
      shared_buffers: "2GB"
      effective_cache_size: "6GB"
```

### 5.2 Redis Cluster

```yaml
# redis/redis-cluster.yaml
apiVersion: redis.redis.opstreelabs.in/v1beta2
kind: RedisCluster
metadata:
  name: redis-cluster
  namespace: world-platform
spec:
  clusterSize: 6
  clusterVersion: v7

  storage:
    volumeClaimTemplate:
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi

  resources:
    requests:
      cpu: 200m
      memory: 512Mi
    limits:
      cpu: 1000m
      memory: 2Gi

  # 持久化配置
  redisConfig:
    maxmemory-policy: allkeys-lru
    save: "900 1 300 10 60 10000"
```

### 5.3 Kafka Cluster

```yaml
# kafka/kafka-cluster.yaml
apiVersion: kafka.strimzi.io/v1beta2
kind: Kafka
metadata:
  name: kafka
  namespace: world-platform
spec:
  kafka:
    version: 3.6.0
    replicas: 3
    listeners:
      - name: plain
        port: 9092
        type: internal
        tls: false
      - name: tls
        port: 9093
        type: internal
        tls: true
    config:
      offsets.topic.replication.factor: 3
      transaction.state.log.replication.factor: 3
      transaction.state.log.min.isr: 2
      default.replication.factor: 3
      min.insync.replicas: 2
      log.retention.hours: 168
    storage:
      type: jbod
      volumes:
        - id: 0
          type: persistent-claim
          size: 100Gi
          class: fast-ssd

  zookeeper:
    replicas: 3
    storage:
      type: persistent-claim
      size: 10Gi

  # Kafka Topics
  entityOperator:
    topicOperator:
      bootstrapServers: kafka-kafka-bootstrap:9092
```

---

## 6. 可观测性配置

### 6.1 Prometheus ServiceMonitor

```yaml
# monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: world-platform
  namespace: world-platform
spec:
  selector:
    matchLabels:
      app.kubernetes.io/part-of: world-platform
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```

### 6.2 Grafana Dashboard ConfigMap

```yaml
# monitoring/grafana-dashboard.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: world-platform-dashboard
  namespace: world-platform
  labels:
    grafana_dashboard: "1"
data:
  dashboard.json: |
    {
      "dashboard": {
        "title": "World Platform Overview",
        "panels": [
          {
            "title": "Active Rooms",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(world_active_rooms)"
              }
            ]
          },
          {
            "title": "Online Users",
            "type": "stat",
            "targets": [
              {
                "expr": "sum(world_online_users)"
              }
            ]
          },
          {
            "title": "WebSocket Connections",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(websocket_connections) by (service)"
              }
            ]
          },
          {
            "title": "Skill Executions/min",
            "type": "graph",
            "targets": [
              {
                "expr": "rate(skill_executions_total[1m])"
              }
            ]
          },
          {
            "title": "Tool Call Latency",
            "type": "heatmap",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, tool_call_duration_seconds_bucket)"
              }
            ]
          }
        ]
      }
    }
```

---

## 7. 灾备方案

### 7.1 备份策略

```yaml
# backup/backup-policy.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: world-backup
  namespace: world-platform
spec:
  schedule: "0 2 * * *"  # 每天凌晨 2 点
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: world-backup:latest
              command:
                - /bin/sh
                - -c
                - |
                  # 备份 PostgreSQL
                  pg_dump $DATABASE_URL > /backup/postgres-$(date +%Y%m%d).sql

                  # 备份 Redis
                  redis-cli --rdb /backup/redis-$(date +%Y%m%d).rdb

                  # 上传到 S3
                  aws s3 sync /backup s3://world-platform-backups/$(date +%Y%m%d)/
              volumeMounts:
                - name: backup
                  mountPath: /backup
          volumes:
            - name: backup
              emptyDir: {}
          restartPolicy: OnFailure
```

### 7.2 灾难恢复流程

```yaml
# disaster-recovery/recovery-plan.yaml
recoveryPlan:
  name: world-platform-dr

  # RTO/RPO 目标
  rto: 1h      # 恢复时间目标
  rpo: 1h      # 恢复点目标

  # 恢复步骤
  steps:
    - id: 1
      name: 恢复数据库
      type: database
      action: restore-from-backup
      timeout: 30m

    - id: 2
      name: 恢复 Redis
      type: cache
      action: restore-from-rdb
      timeout: 10m

    - id: 3
      name: 重建 Kafka Topics
      type: messaging
      action: recreate-topics
      timeout: 5m

    - id: 4
      name: 启动核心服务
      type: service
      action: scale-up
      services: [back, play]
      timeout: 15m

    - id: 5
      name: 验证服务健康
      type: health-check
      action: verify-all
      timeout: 10m

    - id: 6
      name: 恢复流量
      type: traffic
      action: enable-ingress
      timeout: 5m
```

---

## 8. 扩容决策树

```
┌─────────────────────────────────────────────────────────────────┐
│                     扩容触发条件                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
          ┌───────────────────┴───────────────────┐
          │                                       │
    ┌─────▼─────┐                          ┌─────▼─────┐
    │ CPU/内存   │                          │ 连接数/房间 │
    │ > 阈值     │                          │ > 阈值     │
    └─────┬─────┘                          └─────┬─────┘
          │                                       │
          ▼                                       ▼
    ┌───────────┐                          ┌───────────┐
    │ HPA 扩容  │                          │ 房间实例化  │
    │ Pod 数量  │                          │ 分片/副本   │
    └───────────┘                          └───────────┘
          │                                       │
          ▼                                       ▼
    ┌───────────┐                          ┌───────────┐
    │ 节点扩容  │                          │ 世界图谱   │
    │ (如需要)  │                          │ 更新边     │
    └───────────┘                          └───────────┘
```

---

## 9. 成本估算

| 组件 | 配置 | 数量 | 月成本 (估算) |
|------|------|------|--------------|
| Play Nodes | 2 vCPU, 4GiB | 3-20 | $150-$1000 |
| Back Nodes | 4 vCPU, 8GiB | 3-50 | $300-$5000 |
| PostgreSQL | 4 vCPU, 16GiB | 3 | $500 |
| Redis Cluster | 2 vCPU, 4GiB | 6 | $300 |
| Kafka Cluster | 4 vCPU, 8GiB | 3 | $400 |
| OpenClaw Gateway | 4 vCPU, 16GiB | 2-10 | $200-$1000 |
| 网络/存储 | - | - | $200 |
| **总计** | | | **$2050-$8400** |

---

*文档版本: 1.0.0*
*最后更新: 2026-03-05*
