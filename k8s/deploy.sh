#!/bin/bash
# WorkAdventure Kubernetes 一键部署脚本

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   WorkAdventure Kubernetes 部署脚本${NC}"
echo -e "${GREEN}========================================${NC}"

# 配置变量
NAMESPACE="${NAMESPACE:-workadventure}"
DOMAIN="${DOMAIN:-play.local}"
STORAGE_CLASS="${STORAGE_CLASS:-standard}"

echo -e "${YELLOW}配置信息:${NC}"
echo "  命名空间: $NAMESPACE"
echo "  域名: $DOMAIN"
echo "  存储类: $STORAGE_CLASS"
echo ""

# 检查 kubectl
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}错误: kubectl 未安装${NC}"
    exit 1
fi

# 检查集群连接
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}错误: 无法连接到 Kubernetes 集群${NC}"
    exit 1
fi

echo -e "${GREEN}步骤 1/6: 创建命名空间${NC}"
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}步骤 2/6: 创建密钥${NC}"
# PostgreSQL 密钥
kubectl create secret generic postgres-credentials \
    --from-literal=POSTGRES_USER=workadventure \
    --from-literal=POSTGRES_PASSWORD=workadventure_secret \
    --from-literal=POSTGRES_DB=workadventure \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# WorkAdventure 密钥
kubectl create secret generic workadventure-secrets \
    --from-literal=SECRET_KEY=$(openssl rand -hex 32) \
    -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}步骤 3/6: 部署 PostgreSQL${NC}"
cat <<EOF | kubectl apply -n $NAMESPACE -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: $STORAGE_CLASS
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
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
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
EOF

echo -e "${GREEN}步骤 4/6: 部署 Redis${NC}"
cat <<EOF | kubectl apply -n $NAMESPACE -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
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
---
apiVersion: v1
kind: Service
metadata:
  name: redis
spec:
  selector:
    app: redis
  ports:
  - port: 6379
    targetPort: 6379
EOF

echo -e "${GREEN}步骤 5/6: 部署 WorkAdventure${NC}"
cat <<EOF | kubectl apply -n $NAMESPACE -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: workadventure-config
data:
  DEBUG_MODE: "false"
  NODE_ENV: "production"
  POSTGRES_HOST: "postgres"
  POSTGRES_PORT: "5432"
  POSTGRES_USER: "workadventure"
  POSTGRES_DB: "workadventure"
  REDIS_HOST: "redis"
  REDIS_PORT: "6379"
  PUSHER_URL: "http://play.$DOMAIN"
  FRONT_URL: "http://play.$DOMAIN"
  START_ROOM_URL: "/_/global/maps.$DOMAIN/starter/map.json"
  DISABLE_NOTIFICATIONS: "true"
  ENABLE_MAP_EDITOR: "true"
  SECRET_KEY: "from-secret"
  MAX_PER_GROUP: "100"
  MAX_USERNAME_LENGTH: "10"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: play
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
      - name: wait-for-deps
        image: busybox
        command: ['sh', '-c', 'until nc -z postgres 5432 && nc -z redis 6379; do echo waiting; sleep 2; done']
      containers:
      - name: play
        image: thecodingmachine/nodejs:20
        ports:
        - containerPort: 3000
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
---
apiVersion: v1
kind: Service
metadata:
  name: play
spec:
  selector:
    app: play
  ports:
  - port: 80
    targetPort: 3000
EOF

echo -e "${GREEN}步骤 6/6: 等待部署完成${NC}"
kubectl rollout status deployment/postgres -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/redis -n $NAMESPACE --timeout=300s
kubectl rollout status deployment/play -n $NAMESPACE --timeout=600s

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   部署完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "查看状态:"
echo "  kubectl get pods -n $NAMESPACE"
echo ""
echo -e "查看日志:"
echo "  kubectl logs -f deployment/play -n $NAMESPACE"
echo ""
echo -e "端口转发 (本地测试):"
echo "  kubectl port-forward svc/play 8080:80 -n $NAMESPACE"
echo ""
echo -e "然后访问: http://localhost:8080"
