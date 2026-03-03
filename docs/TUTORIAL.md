# WorkAdventure 完整使用教程

## 目录

1. [快速开始](#快速开始)
2. [服务访问地址](#服务访问地址)
3. [登录凭据汇总](#登录凭据汇总)
4. [新功能使用指南](#新功能使用指南)
5. [常见问题](#常见问题)

---

## 快速开始

### 1. 启动服务

```bash
cd /root/GLM/workadventure-master

# 启动所有服务
docker compose up -d

# 启动 PostgreSQL 数据库 (新增)
docker compose -f docker-compose.postgres.yaml up -d
```

### 2. 访问应用

打开浏览器访问: **http://play.workadventure.localhost**

---

## 服务访问地址

| 服务名称 | 访问地址 | 说明 |
|----------|----------|------|
| **WorkAdventure 主应用** | http://play.workadventure.localhost | 虚拟协作空间主页面 |
| **Traefik 仪表板** | http://traefik.workadventure.localhost:8080 | 反向代理管理界面 |
| **Redis Insight** | http://redis.workadventure.localhost | Redis 数据库可视化 |
| **OIDC 登录服务** | http://oidc.workadventure.localhost | OpenID Connect 身份验证 |
| **Matrix 聊天服务** | http://matrix.workadventure.localhost | 聊天服务器 |
| **Map Storage** | http://map-storage.workadventure.localhost | 地图存储服务 |
| **图标服务** | http://icon.workadventure.localhost | 头像图标生成 |

---

## 登录凭据汇总

### 1. OIDC Server Mock (OpenID Connect 登录)

WorkAdventure 使用 OIDC Server Mock 作为测试用的身份验证服务器。

| 用户名 | 密码 | 邮箱 | 角色 |
|--------|------|------|------|
| `User1` | `pwd` | john.doe@example.com | admin |
| `User2` | `pwd` | alice.doe@example.com | member |
| `UserMatrix` | `pwd` | john.doe@example.com | admin |

**登录步骤**:
1. 访问 http://play.workadventure.localhost
2. 点击登录按钮
3. 在 OIDC 登录页面输入用户名和密码
4. 授权后自动返回 WorkAdventure

---

### 2. PostgreSQL 数据库

| 项目 | 值 |
|------|-----|
| 主机 | `localhost` |
| 端口 | `5432` |
| 用户名 | `workadventure` |
| 密码 | `workadventure_secret` |
| 数据库 | `workadventure` |

**连接方式**:
```bash
# 命令行连接
psql -h localhost -U workadventure -d workadventure
# 密码: workadventure_secret

# Docker 内部连接
docker exec -it workadventure-postgres psql -U workadventure -d workadventure
```

---

### 3. pgAdmin (数据库管理界面)

| 项目 | 值 |
|------|-----|
| 访问地址 | http://localhost:5050 |
| 邮箱 | `admin@workadventure.localhost` |
| 密码 | `admin` |

**添加服务器连接**:
1. 登录 pgAdmin
2. 右键 "Servers" → "Register" → "Server"
3. General 标签: 名称填写 `WorkAdventure`
4. Connection 标签:
   - Host: `postgres` (Docker 网络) 或 `localhost` (外部)
   - Port: `5432`
   - Username: `workadventure`
   - Password: `workadventure_secret`
   - Database: `workadventure`

---

### 4. Redis

| 项目 | 值 |
|------|-----|
| 主机 | `redis` (Docker) / `localhost` (外部) |
| 端口 | `6379` |
| 密码 | 无 (开发环境) |

**连接方式**:
```bash
redis-cli -h localhost -p 6379
```

---

### 5. Map Storage 服务

| 项目 | 值 |
|------|-----|
| 用户名 | `john.doe` |
| 密码 | `password` |
| Bearer Token | `123` |

**访问方式**:
```bash
# Basic Auth
curl -u john.doe:password http://map-storage.workadventure.localhost/api/maps

# Bearer Token
curl -H "Authorization: Bearer 123" http://map-storage.workadventure.localhost/api/maps
```

---

### 6. Matrix/Synapse (聊天服务器)

| 项目 | 值 |
|------|-----|
| 管理员用户 | `admin` |
| 域名 | `matrix.workadventure.localhost` |

---

## 新功能使用指南

### 1. 钱包登录 (Wallet Login)

WorkAdventure 现在支持加密货币钱包登录。

**支持的钱包**:
- MetaMask
- Rainbow
- Coinbase Wallet
- WalletConnect (移动端扫码)

**启用钱包登录**:

在 `.env` 文件中添加:
```bash
WALLET_AUTH_ENABLED=true
WALLET_CHAIN_ID=1        # 以太坊主网
WALLET_PROJECT_ID=your_walletconnect_project_id
```

**登录步骤**:
1. 安装 MetaMask 浏览器扩展
2. 访问 WorkAdventure
3. 点击 "连接钱包"
4. 选择钱包类型
5. 在钱包中签名消息
6. 完成登录

---

### 2. AI NPC 系统

在地图中添加 AI 驱动的 NPC 角色。

**配置步骤**:

1. 在 Tiled 地图编辑器中创建 `ai-npcs` 图层
2. 添加对象并设置属性:

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | string | NPC 名称 |
| `personality` | string | AI 性格描述 |
| `systemPrompt` | string | 系统提示词 |
| `triggerDistance` | number | 触发距离 (默认 64) |
| `greeting` | string | 问候语 |
| `texture` | string | 精灵贴图名称 |

**示例配置**:
```json
{
  "name": "导游小美",
  "personality": "热情友好的导游",
  "systemPrompt": "你是一个热情的导游，帮助访客了解这个区域。",
  "triggerDistance": 64,
  "greeting": "欢迎来到我们的虚拟空间！有什么可以帮你的吗？"
}
```

---

### 3. AI 触发区域

玩家进入特定区域时自动打开 AI 聊天。

**配置步骤**:

1. 在 Tiled 中创建 `ai-zones` 图层
2. 绘制矩形区域并设置属性:

| 属性 | 类型 | 说明 |
|------|------|------|
| `name` | string | 区域名称 |
| `systemPrompt` | string | AI 系统提示词 |
| `greeting` | string | 进入时的欢迎消息 |
| `autoOpen` | boolean | 是否自动打开聊天 |
| `triggerOnce` | boolean | 是否只触发一次 |
| `cooldownMs` | number | 冷却时间 (毫秒) |

---

### 4. 邀请系统

创建邀请码，邀请新用户注册获取奖励。

**API 端点**:

```bash
# 创建邀请码
curl -X POST http://play.workadventure.localhost/invite/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"maxUses": 10}'

# 获取我的邀请码
curl http://play.workadventure.localhost/invite/my-codes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 获取邀请统计
curl http://play.workadventure.localhost/invite/stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 使用邀请码
curl -X POST http://play.workadventure.localhost/invite/claim \
  -H "Content-Type: application/json" \
  -d '{"code": "INVITE123", "walletAddress": "0x..."}'
```

---

### 5. 积分和徽章系统

**获取积分的方式**:
- 被邀请注册: +10 积分
- 邀请他人注册: +10 积分

**NFT 徽章类型**:

| 徽章 ID | 名称 | 获取条件 | 稀有度 |
|---------|------|----------|--------|
| `early_adopter` | 早期采用者 | 前1000名注册 | legendary |
| `first_invite` | 首次邀请 | 首次成功邀请 | rare |
| `super_inviter` | 超级邀请者 | 邀请10人以上 | epic |
| `ai_explorer` | AI 探索者 | 与 AI 交互10次 | rare |
| `verified_user` | 认证用户 | 完成身份验证 | common |

---

### 6. OpenClaw AI 聊天

内置 AI 助手功能。

**启用 OpenClaw**:

在 `.env` 文件中配置:
```bash
OPENCLAW_ENABLED=true
OPENCLAW_GATEWAY_URL=ws://localhost:18789
OPENCLAW_DEFAULT_MODEL=gpt-4
OPENCLAW_TRIGGER_PREFIX=/ai
```

**使用方式**:
1. 在聊天中输入 `/ai 你的问题`
2. AI 会自动回复

---

---

## 常用命令

### Docker Compose 命令

```bash
# 查看所有服务状态
docker compose ps

# 查看服务日志
docker compose logs play           # Play 服务日志
docker compose logs postgres       # PostgreSQL 日志
docker compose logs -f play        # 实时跟踪日志
docker compose logs --tail=100 play  # 最后100行日志

# 重启服务
docker compose restart play
docker compose restart postgres

# 停止所有服务
docker compose down

# 启动所有服务
docker compose up -d

# 重新构建并启动
docker compose up -d --build

# 查看资源使用
docker stats
```

### Kubernetes 命令

```bash
# 查看所有资源
kubectl get all -n workadventure

# 查看 Pods 状态
kubectl get pods -n workadventure

# 查看服务日志
kubectl logs -f deployment/postgres -n workadventure
kubectl logs -f deployment/redis -n workadventure

# 端口转发（本地测试）
kubectl port-forward svc/postgres 5432:5432 -n workadventure
kubectl port-forward svc/redis 6379:6379 -n workadventure

# 进入容器
kubectl exec -it deployment/postgres -n workadventure -- /bin/sh
```

### 数据库命令

```bash
# 连接 PostgreSQL（Docker）
docker exec -it workadventure-postgres psql -U workadventure -d workadventure

# 连接 PostgreSQL（本地）
psql -h localhost -U workadventure -d workadventure
# 密码: workadventure_secret

# 连接 Redis
redis-cli -h localhost -p 6379
```

---

## 常见问题

### Q1: 无法访问 play.workadventure.localhost

**解决方案**:
1. 确保在 `/etc/hosts` 文件中添加:
   ```
   127.0.0.1 play.workadventure.localhost
   127.0.0.1 front.workadventure.localhost
   127.0.0.1 oidc.workadventure.localhost
   ```
2. 检查 Docker 容器是否正常运行:
   ```bash
   docker compose ps
   ```
3. 查看日志:
   ```bash
   docker compose logs play
   ```

### Q2: pgAdmin 无法启动

**解决方案**:

pgAdmin 对邮箱格式要求严格，修改 `.env`:
```bash
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=your_password
```

### Q3: 钱包登录失败

**解决方案**:
1. 确保已安装 MetaMask
2. 检查 `.env` 中 `WALLET_AUTH_ENABLED=true`
3. 确保 `SECRET_KEY` 已设置
4. 检查控制台错误日志

### Q4: AI NPC 不显示

**解决方案**:
1. 确保 `OPENCLAW_ENABLED=true`
2. 检查地图中是否有 `ai-npcs` 图层
3. 查看 OpenClaw 服务是否运行:
   ```bash
   docker ps | grep openclaw
   ```

### Q5: 邀请码无法使用

**解决方案**:
1. 确保数据库连接正常
2. 检查邀请码是否已过期
3. 确认邀请码未达到最大使用次数

### Q6: 如何重置数据库

```bash
# 停止并删除 PostgreSQL 容器和数据
docker compose -f docker-compose.postgres.yaml down -v

# 重新启动
docker compose -f docker-compose.postgres.yaml up -d
```

---

## 环境变量配置

完整的 `.env` 配置示例:

```bash
# ===== 基础配置 =====
DEBUG_MODE=false
SECRET_KEY=yourSecretKey2020

# ===== 数据库配置 =====
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=workadventure
POSTGRES_PASSWORD=workadventure_secret
POSTGRES_DATABASE=workadventure

# ===== OpenID Connect =====
OPENID_CLIENT_ID=authorization-code-client-id
OPENID_CLIENT_SECRET=secret
OPENID_CLIENT_ISSUER=http://oidc.workadventure.localhost

# ===== OpenClaw AI =====
OPENCLAW_ENABLED=false
OPENCLAW_GATEWAY_URL=ws://127.0.0.1:18789
OPENCLAW_API_KEY=
OPENCLAW_DEFAULT_MODEL=gpt-4
OPENCLAW_TRIGGER_PREFIX=/ai

# ===== 钱包登录 =====
WALLET_AUTH_ENABLED=false
WALLET_CHAIN_ID=1
WALLET_PROJECT_ID=

# ===== 邀请系统 =====
INVITE_ENABLED=true
INVITE_REWARD_POINTS=10

# ===== pgAdmin =====
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
```

---

## 技术支持

如有问题，请查看:
- 项目 GitHub: https://github.com/thecodingmachine/workadventure
- 问题反馈: https://github.com/thecodingmachine/workadventure/issues
