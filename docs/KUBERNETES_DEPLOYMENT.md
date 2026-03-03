# WorkAdventure Kubernetes 部署教程

> ⚠️ **重要提示**: Kubernetes 生产部署需要预先构建 Docker 镜像。开发环境建议使用 Docker Compose。
>
> - **开发环境**: 使用 `docker compose up -d` 快速启动
> - **生产环境**: 按照本文档构建自定义镜像后部署

## 目录

1. [环境准备](#环境准备)
2. [构建 Docker 镜像](#构建-docker-镜像)
3. [创建命名空间](#创建命名空间)
3. [配置持久化存储](#配置持久化存储)
4. [部署 PostgreSQL](#部署-postgresql)
5. [部署 Redis](#部署-redis)
6. [部署 WorkAdventure](#部署-workadventure)
7. [配置 Ingress](#配置-ingress)
8. [验证部署](#验证部署)
9. [常用操作](#常用操作)

---

## 环境准备

### 前置条件

- Kubernetes 集群 (kubeadm, minikube, 或云托管 K8s)
- kubectl 已配置并可访问集群
- helm 3.x (可选)
- 至少 8GB 内存, 4 CPU 可用

### 安装 kubectl (如果未安装)

```bash
# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# 验证安装
kubectl version --client
```

### 安装 helm (如果未安装)

```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version
```

---

## 构建 Docker 镜像

Kubernetes 生产部署需要构建包含应用代码的 Docker 镜像。

### 方式一：使用项目 Dockerfile（推荐）

```bash
cd /root/GLM/workadventure-master

# 构建 Play 服务镜像
docker build -t workadventure-play:latest -f play/Dockerfile .

# 构建 Back 服务镜像
docker build -t workadventure-back:latest -f back/Dockerfile .

# 构建 Map Storage 镜像
docker build -t workadventure-map-storage:latest -f map-storage/Dockerfile .
```

### 方式二：推送到私有镜像仓库

```bash
# 标记镜像
docker tag workadventure-play:latest your-registry.com/workadventure-play:latest
docker tag workadventure-back:latest your-registry.com/workadventure-back:latest

# 推送镜像
docker push your-registry.com/workadventure-play:latest
docker push your-registry.com/workadventure-back:latest
```

### 方式三：使用本地 Registry

```bash
# 启动本地 Registry
docker run -d -p 5000:5000 --restart=always --name local-registry registry:2

# 标记并推送
docker tag workadventure-play:latest localhost:5000/workadventure-play:latest
docker push localhost:5000/workadventure-play:latest
```

---

## 创建命名空间

```bash
# 创建命名空间
kubectl create namespace workadventure

# 设置默认命名空间 (可选)
kubectl config set-context --current --namespace=workadventure
```

---

## 配置持久化存储

### 创建存储类 (StorageClass)

```bash
cat <<EOF | kubectl apply -f -
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: workadventure-storage
  namespace: workadventure
provisioner: kubernetes.io/gce-pd  # 根据云提供商修改
parameters:
  type: pd-standard
reclaimPolicy: Retain
allowVolumeExpansion: true
EOF
```

### 本地开发使用 local-path (可选)

```bash
# 安装 local-path-provisioner
kubectl apply -f https://raw.githubusercontent.com/rancher/local-path-provisioner/master/deploy/local-path-storage.yaml

# 设置为默认存储类
kubectl patch storageclass local-path -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

---

## 部署 PostgreSQL

### 创建 PostgreSQL 密码

```bash
kubectl create secret generic postgres-credentials \
  --from-literal=POSTGRES_USER=workadventure \
  --from-literal=POSTGRES_PASSWORD=workadventure_secret \
  --from-literal=POSTGRES_DB=workadventure \
  -n workadventure
```

### 创建 PVC

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: workadventure
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: standard  # 根据集群配置修改
EOF
```

### 部署 PostgreSQL

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: workadventure
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: POSTGRES_USER
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: POSTGRES_PASSWORD
        - name: POSTGRES_DB
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: POSTGRES_DB
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - workadventure
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - workadventure
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: workadventure
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
EOF
```

---

## 部署 Redis

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: workadventure
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:6-alpine
        ports:
        - containerPort: 6379
        command:
        - redis-server
        - --appendonly
        - "yes"
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: workadventure
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
  type: ClusterIP
EOF
```

---

## 部署 WorkAdventure

### 创建应用密钥

```bash
kubectl create secret generic workadventure-secrets \
  --from-literal=SECRET_KEY=yourSecretKey2020 \
  --from-literal=JWT_SECRET=yourJwtSecret2020 \
  -n workadventure
```

### 创建 ConfigMap

```bash
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: workadventure-config
  namespace: workadventure
data:
  DEBUG_MODE: "false"
  NODE_ENV: "production"
  POSTGRES_HOST: "postgres"
  POSTGRES_PORT: "5432"
  POSTGRES_USER: "workadventure"
  POSTGRES_DB: "workadventure"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  PUSHER_URL: "https://play.yourdomain.com"
  FRONT_URL: "https://play.yourdomain.com"
  ADMIN_URL: "https://admin.yourdomain.com"
  UPLOADER_URL: "https://uploader.yourdomain.com"
  ICON_URL: "https://icon.yourdomain.com"
  START_ROOM_URL: "/_/global/maps.yourdomain.com/starter/map.json"
  DISABLE_NOTIFICATIONS: "true"
  ENABLE_MAP_EDITOR: "true"
  JITSI_URL: "meet.jit.si"
  JITSI_PRIVATE_MODE: "false"
  MAX_PER_GROUP: "100"
  MAX_USERNAME_LENGTH: "10"
  # OpenClaw AI
  OPENCLAW_ENABLED: "false"
  OPENCLAW_GATEWAY_URL: "ws://openclaw-gateway:18789"
  OPENCLAW_DEFAULT_MODEL: "gpt-4"
  OPENCLAW_TRIGGER_PREFIX: "/ai"
  # Wallet
  WALLET_AUTH_ENABLED: "false"
  WALLET_CHAIN_ID: "1"
  # Invite
  INVITE_ENABLED: "true"
  INVITE_REWARD_POINTS: "10"
EOF
```

### 部署 Play 服务 (前端 + Pusher)

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: play
  namespace: workadventure
spec:
  replicas: 2
  selector:
    matchLabels:
      app: play
  template:
    metadata:
      labels:
        app: play
    spec:
      initContainers:
      - name: wait-for-postgres
        image: busybox
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done']
      - name: wait-for-redis
        image: busybox
        command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done']
      containers:
      - name: play
        image: thecodingmachine/nodejs:20
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 3001
          name: websocket
        envFrom:
        - configMapRef:
            name: workadventure-config
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: workadventure-secrets
              key: SECRET_KEY
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: POSTGRES_PASSWORD
        command: ["npm", "run", "start"]
        workingDir: /usr/src/app/play
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 60
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 5
        volumeMounts:
        - name: app-code
          mountPath: /usr/src/app
      volumes:
      - name: app-code
        emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: play
  namespace: workadventure
spec:
  selector:
    app: play
  ports:
  - name: http
    port: 80
    targetPort: 3000
  - name: websocket
    port: 3001
    targetPort: 3001
  type: ClusterIP
EOF
```

### 部署 Back 服务

```bash
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: back
  namespace: workadventure
spec:
  replicas: 2
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
        image: thecodingmachine/nodejs:22
        ports:
        - containerPort: 8080
        envFrom:
        - configMapRef:
            name: workadventure-config
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: workadventure-secrets
              key: SECRET_KEY
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: POSTGRES_PASSWORD
        command: ["npm", "run", "start"]
        workingDir: /usr/src/app/back
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 60
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: back
  namespace: workadventure
spec:
  selector:
    app: back
  ports:
  - port: 8080
    targetPort: 8080
  type: ClusterIP
EOF
```

---

## 配置 Ingress

### 安装 NGINX Ingress Controller (如果未安装)

```bash
# 使用 Helm 安装
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# 或使用 kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
```

### 创建 Ingress 规则

```bash
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: workadventure-ingress
  namespace: workadventure
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "false"
    nginx.ingress.kubernetes.io/proxy-websockets: "true"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
spec:
  ingressClassName: nginx
  rules:
  - host: play.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: play
            port:
              number: 80
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: back
            port:
              number: 8080
EOF
```

### 配置 TLS (可选)

```bash
# 安装 cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.1/cert-manager.yaml

# 创建 ClusterIssuer
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# 更新 Ingress 添加 TLS
cat <<EOF | kubectl apply -f -
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: workadventure-ingress-tls
  namespace: workadventure
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-websockets: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - play.yourdomain.com
    - api.yourdomain.com
    secretName: workadventure-tls
  rules:
  - host: play.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: play
            port:
              number: 80
  - host: api.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: back
            port:
              number: 8080
EOF
```

---

## 验证部署

### 检查 Pod 状态

```bash
# 查看所有 Pod
kubectl get pods -n workadventure

# 查看详细信息
kubectl describe pod <pod-name> -n workadventure

# 查看日志
kubectl logs -f deployment/play -n workadventure
kubectl logs -f deployment/back -n workadventure
kubectl logs -f deployment/postgres -n workadventure
```

### 检查服务

```bash
kubectl get services -n workadventure
kubectl get endpoints -n workadventure
```

### 检查 Ingress

```bash
kubectl get ingress -n workadventure
kubectl describe ingress workadventure-ingress -n workadventure
```

### 获取访问地址

```bash
# 获取 Ingress IP
kubectl get ingress -n workadventure

# 获取 LoadBalancer IP (如果使用)
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

---

## 查看服务状态

### 查看所有资源

```bash
# 查看命名空间内所有资源
kubectl get all -n workadventure

# 查看详细信息（pods, services, deployments, pvc, secrets, configmaps）
kubectl get pods,svc,deploy,pvc,secret,configmap -n workadventure
```

### 查看 Pods

```bash
# 列出所有 Pod
kubectl get pods -n workadventure

# 查看 Pod 详情
kubectl describe pod <pod-name> -n workadventure

# 查看 Pod 日志
kubectl logs <pod-name> -n workadventure
kubectl logs -f deployment/postgres -n workadventure  # 实时跟踪

# 查看多个容器的日志
kubectl logs -f deployment/play -c play -n workadventure
```

### 查看服务

```bash
# 列出所有服务
kubectl get services -n workadventure

# 查看服务详情
kubectl describe service postgres -n workadventure

# 查看 Endpoints
kubectl get endpoints -n workadventure
```

### 查看部署状态

```bash
# 列出所有部署
kubectl get deployments -n workadventure

# 查看部署详情
kubectl describe deployment postgres -n workadventure

# 查看滚动更新状态
kubectl rollout status deployment/play -n workadventure
```

### 查看持久化存储

```bash
# 查看 PVC
kubectl get pvc -n workadventure

# 查看 PV
kubectl get pv

# 查看存储类
kubectl get storageclass
```

### 查看密钥和配置

```bash
# 查看密钥列表
kubectl get secrets -n workadventure

# 查看密钥详情（不显示值）
kubectl describe secret postgres-credentials -n workadventure

# 查看 ConfigMap
kubectl get configmap -n workadventure
kubectl describe configmap workadventure-config -n workadventure
```

---

## 常用操作

### 扩缩容

```bash
# 手动扩容
kubectl scale deployment play --replicas=3 -n workadventure
kubectl scale deployment back --replicas=2 -n workadventure

# 自动扩容 (HPA)
kubectl autoscale deployment play --min=2 --max=10 --cpu-percent=80 -n workadventure
```

### 更新部署

```bash
# 更新镜像
kubectl set image deployment/play play=thecodingmachine/nodejs:21 -n workadventure

# 查看滚动更新状态
kubectl rollout status deployment/play -n workadventure

# 回滚
kubectl rollout undo deployment/play -n workadventure
kubectl rollout undo deployment/play --to-revision=2 -n workadventure
```

### 查看日志

```bash
# 实时日志
kubectl logs -f deployment/play -n workadventure

# 多容器日志
kubectl logs -f deployment/play -c play -n workadventure

# 查看之前的日志
kubectl logs deployment/play --previous -n workadventure
```

### 进入容器

```bash
kubectl exec -it deployment/play -n workadventure -- /bin/bash
```

### 端口转发 (调试用)

```bash
# 本地访问 Play 服务
kubectl port-forward svc/play 8080:80 -n workadventure

# 本地访问 PostgreSQL
kubectl port-forward svc/postgres 5432:5432 -n workadventure

# 本地访问 Redis
kubectl port-forward svc/redis 6379:6379 -n workadventure
```

### 备份与恢复

```bash
# 备份 PostgreSQL
kubectl exec deployment/postgres -n workadventure -- pg_dump -U workadventure workadventure > backup.sql

# 恢复 PostgreSQL
cat backup.sql | kubectl exec -i deployment/postgres -n workadventure -- psql -U workadventure workadventure
```

### 清理资源

```bash
# 删除部署
kubectl delete -n workadventure deployment --all

# 删除服务
kubectl delete -n workadventure service --all

# 删除整个命名空间 (谨慎!)
kubectl delete namespace workadventure
```

---

## 故障排查

### Pod 无法启动

```bash
# 查看 Pod 事件
kubectl describe pod <pod-name> -n workadventure

# 查看容器日志
kubectl logs <pod-name> -n workadventure

# 检查资源限制
kubectl top pods -n workadventure
kubectl describe resourcequota -n workadventure
```

### 服务无法访问

```bash
# 检查 Endpoints
kubectl get endpoints -n workadventure

# 检查服务配置
kubectl describe service play -n workadventure

# DNS 测试
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup play.workadventure.svc.cluster.local
```

### 数据库连接失败

```bash
# 测试连接
kubectl run -it --rm pg-test --image=postgres:16 --restart=Never -- \
  psql postgresql://workadventure:workadventure_secret@postgres:5432/workadventure

# 检查密钥
kubectl get secret postgres-credentials -n workadventure -o yaml
```

---

## 生产环境建议

### 资源配置

| 服务 | CPU 请求 | CPU 限制 | 内存请求 | 内存限制 |
|------|----------|----------|----------|----------|
| Play | 500m | 2 | 512Mi | 2Gi |
| Back | 250m | 1 | 256Mi | 1Gi |
| PostgreSQL | 500m | 2 | 512Mi | 2Gi |
| Redis | 100m | 500m | 128Mi | 512Mi |

### 安全建议

1. 使用 NetworkPolicy 限制 Pod 间通信
2. 使用 PodSecurityPolicy/PodSecurityStandards
3. 启用 RBAC
4. 定期更新镜像
5. 使用 Secret 管理工具 (Vault, Sealed Secrets)

### 监控建议

1. 部署 Prometheus + Grafana
2. 配置 AlertManager 告警
3. 使用 Loki 收集日志
4. 配置 Jaeger 链路追踪

### 高可用建议

1. 多副本部署 (至少 3 个)
2. Pod 反亲和性 (跨节点)
3. 多可用区部署
4. 配置 PDB (PodDisruptionBudget)
5. 数据库主从复制

---

## 联系支持

- GitHub: https://github.com/thecodingmachine/workadventure
- 文档: https://docs.workadventu.re
- 社区: https://github.com/thecodingmachine/workadventure/discussions

---

## 快速部署

使用一键部署脚本:

```bash
cd /root/GLM/workadventure-master/k8s

# 设置环境变量 (可选)
export DOMAIN=yourdomain.com
export STORAGE_CLASS=standard

# 执行部署
./deploy.sh
```

部署完成后:

```bash
# 查看状态
kubectl get pods -n workadventure

# 本地测试
kubectl port-forward svc/play 8080:80 -n workadventure

# 访问 http://localhost:8080
```

---

## 当前部署状态

### 已部署的服务

| 组件 | 状态 | 说明 |
|------|------|------|
| PostgreSQL | ✅ Running | 数据库服务，端口 5432 |
| Redis | ✅ Running | 缓存服务，端口 6379 |
| Play | ⚠️ 待构建 | 需要先构建 Docker 镜像 |

### 服务访问地址 (ClusterIP)

| 服务 | ClusterIP | 端口 |
|------|-----------|------|
| postgres | 10.106.133.160 | 5432 |
| redis | 10.98.197.120 | 6379 |
| play | 10.98.54.124 | 80 |

### 登录凭据

| 服务 | 用户名 | 密码 |
|------|--------|------|
| PostgreSQL | workadventure | workadventure_secret |
| 数据库 | workadventure | - |

---

## 快速命令参考

```bash
# ===== 查看状态 =====
kubectl get all -n workadventure                    # 查看所有资源
kubectl get pods -n workadventure                   # 查看 Pods
kubectl get svc -n workadventure                    # 查看服务
kubectl get pvc -n workadventure                    # 查看持久化存储

# ===== 日志查看 =====
kubectl logs -f deployment/postgres -n workadventure    # PostgreSQL 日志
kubectl logs -f deployment/redis -n workadventure        # Redis 日志
kubectl logs -f deployment/play -n workadventure         # Play 日志

# ===== 进入容器 =====
kubectl exec -it deployment/postgres -n workadventure -- /bin/sh
kubectl exec -it deployment/redis -n workadventure -- redis-cli

# ===== 端口转发 =====
kubectl port-forward svc/postgres 5432:5432 -n workadventure    # 本地访问 PostgreSQL
kubectl port-forward svc/redis 6379:6379 -n workadventure        # 本地访问 Redis
kubectl port-forward svc/play 8080:80 -n workadventure           # 本地访问 Play

# ===== 重启服务 =====
kubectl rollout restart deployment/postgres -n workadventure
kubectl rollout restart deployment/redis -n workadventure

# ===== 删除服务 =====
kubectl delete deployment play -n workadventure
kubectl delete deployment postgres -n workadventure
kubectl delete deployment redis -n workadventure

# ===== 完全清理 =====
kubectl delete namespace workadventure    # 删除整个命名空间（危险操作！）
```
