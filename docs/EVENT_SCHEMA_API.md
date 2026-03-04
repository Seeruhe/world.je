# World Event Schema & API 清单

> 版本: 1.0.0 | 更新时间: 2026-03-05

---

## 1. 事件 Schema (World Event Schema)

### 1.1 核心事件结构

```typescript
/**
 * 世界事件 - 所有事件的基础结构
 */
interface WorldEvent {
  /** 事件唯一标识 (UUID v4) */
  event_id: string;

  /** 事件时间戳 (Unix ms) */
  ts: number;

  /** Schema 版本 */
  version: string;  // "1.0.0"

  /** 全链路追踪 ID */
  trace_id: string;

  /** 事件发起者 */
  actor: EventActor;

  /** 事件上下文 */
  context: EventContext;

  /** 事件类型 */
  type: WorldEventType;

  /** 事件负载 */
  payload: Record<string, unknown>;
}

/**
 * 事件发起者
 */
interface EventActor {
  /** 发起者类型 */
  type: 'user' | 'system' | 'npc' | 'flow' | 'tool';

  /** 发起者 ID */
  id: string;

  /** 角色 (可选) */
  role?: string;

  /** 显示名称 (可选) */
  displayName?: string;
}

/**
 * 事件上下文
 */
interface EventContext {
  /** 组织 ID */
  orgId?: string;

  /** 项目 ID */
  projectId?: string;

  /** 房间 ID */
  roomId: string;

  /** 实例 ID (分片/副本) */
  instanceId?: string;

  /** 区域 ID */
  zoneId?: string;

  /** 世界 ID */
  worldId?: string;
}
```

### 1.2 事件类型枚举

```typescript
type WorldEventType =
  // 房间事件
  | 'room.join'
  | 'room.leave'
  | 'room.create'
  | 'room.delete'
  | 'room.instance.split'
  | 'room.instance.merge'

  // 区域事件
  | 'zone.enter'
  | 'zone.leave'
  | 'zone.trigger'

  // 物品事件
  | 'item.click'
  | 'item.pickup'
  | 'item.drop'
  | 'item.use'
  | 'item.spawn'
  | 'item.destroy'

  // 技能事件
  | 'skill.use.requested'
  | 'skill.use.started'
  | 'skill.use.completed'
  | 'skill.use.failed'
  | 'skill.install'
  | 'skill.uninstall'

  // 工具事件
  | 'tool.call.started'
  | 'tool.call.succeeded'
  | 'tool.call.failed'

  // NPC 事件
  | 'npc.talk'
  | 'npc.interact'
  | 'npc.spawn'
  | 'npc.despawn'

  // 世界状态事件
  | 'world.state.updated'
  | 'world.expanded'        // 新房间生成
  | 'world.contracted'      // 房间回收

  // 用户事件
  | 'user.connect'
  | 'user.disconnect'
  | 'user.mute'
  | 'user.unmute'

  // 治理事件
  | 'policy.violation'
  | 'audit.log';
```

### 1.3 各事件 Payload 定义

#### 房间事件

```typescript
// room.join
interface RoomJoinPayload {
  userId: string;
  previousRoomId?: string;
  position: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

// room.leave
interface RoomLeavePayload {
  userId: string;
  nextRoomId?: string;
  duration: number;  // 在房间停留时间 (ms)
}

// room.instance.split
interface RoomInstanceSplitPayload {
  originalInstanceId: string;
  newInstanceIds: string[];
  reason: 'capacity' | 'performance' | 'manual';
}
```

#### 区域事件

```typescript
// zone.enter
interface ZoneEnterPayload {
  zoneId: string;
  zoneName: string;
  zoneType: ZoneType;
  userId: string;
  position: { x: number; y: number };
  triggeredBy?: string;  // 触发源 (物品/NPC/技能)
}

// zone.leave
interface ZoneLeavePayload {
  zoneId: string;
  userId: string;
  duration: number;
  triggers?: string[];  // 离开时触发的效果
}

// zone.trigger
interface ZoneTriggerPayload {
  zoneId: string;
  triggerType: 'enter' | 'stay' | 'exit' | 'interact';
  abilityId?: string;
  parameters?: Record<string, unknown>;
}

type ZoneType =
  | 'public'
  | 'private'
  | 'restricted'
  | 'event'
  | 'lab'
  | 'office'
  | 'meeting';
```

#### 物品事件

```typescript
// item.click
interface ItemClickPayload {
  itemId: string;
  itemType: string;
  position: { x: number; y: number };
  abilityId?: string;  // 点击触发的技能
}

// item.use
interface ItemUsePayload {
  itemId: string;
  itemType: string;
  targetId?: string;   // 目标 (其他物品/NPC/区域)
  abilityId: string;
  parameters?: Record<string, unknown>;
}
```

#### 技能事件

```typescript
// skill.use.requested
interface SkillUseRequestedPayload {
  skillId: string;
  skillName: string;
  targetId?: string;
  targetType?: 'device' | 'virtual-area' | 'external-api' | 'open-project';
  parameters?: Record<string, unknown>;
  requestedBy: string;
}

// skill.use.started
interface SkillUseStartedPayload {
  skillId: string;
  executionId: string;
  targetId?: string;
  mode: 'server' | 'agent' | 'hybrid';
}

// skill.use.completed
interface SkillUseCompletedPayload {
  skillId: string;
  executionId: string;
  output?: unknown;
  executionTime: number;
  tokensUsed?: number;
}

// skill.use.failed
interface SkillUseFailedPayload {
  skillId: string;
  executionId: string;
  error: string;
  errorCode: string;
  retryable: boolean;
}
```

#### 工具事件

```typescript
// tool.call.started
interface ToolCallStartedPayload {
  toolId: string;
  toolName: string;
  serverId: string;     // MCP Server ID
  inputHash: string;    // 输入的 hash (用于审计)
  riskLevel: 'low' | 'medium' | 'high';
}

// tool.call.succeeded
interface ToolCallSucceededPayload {
  toolId: string;
  executionId: string;
  outputHash?: string;  // 输出的 hash
  executionTime: number;
  redacted?: boolean;   // 是否被脱敏
}

// tool.call.failed
interface ToolCallFailedPayload {
  toolId: string;
  executionId: string;
  error: string;
  errorCode: string;
  inputRedacted?: string;  // 脱敏后的输入
}
```

---

## 2. API 清单

### 2.1 WebSocket API (实时通信)

**端点**: `ws://play.workadventure.localhost/ws/`

#### 消息格式

```typescript
// 请求
interface WSRequest<T = unknown> {
  type: string;
  requestId: string;
  payload: T;
}

// 响应
interface WSResponse<T = unknown> {
  type: string;
  requestId: string;
  success: boolean;
  payload?: T;
  error?: { code: string; message: string };
  timestamp: number;
}
```

#### 房间 API

| 操作 | Type | Payload | 描述 |
|------|------|---------|------|
| 加入房间 | `room.join` | `{ roomId, position? }` | 加入指定房间 |
| 离开房间 | `room.leave` | `{}` | 离开当前房间 |
| 移动 | `user.move` | `{ x, y, direction }` | 移动角色 |
| 发送消息 | `chat.send` | `{ message, target? }` | 发送聊天消息 |

#### 技能 API

| 操作 | Type | Payload | 描述 |
|------|------|---------|------|
| 列出技能 | `skills.list` | `{ category?, installed? }` | 获取技能列表 |
| 技能详情 | `skills.info` | `{ skillId }` | 获取技能详情 |
| 安装技能 | `skills.install` | `{ skillId, config? }` | 安装技能 |
| 卸载技能 | `skills.uninstall` | `{ skillId }` | 卸载技能 |
| 执行技能 | `skills.execute` | `{ skillId, targetId?, params? }` | 执行技能 |

#### 目标 API

| 操作 | Type | Payload | 描述 |
|------|------|---------|------|
| 列出目标 | `targets.list` | `{ type?, status? }` | 获取目标列表 |
| 注册目标 | `targets.register` | `{ name, type, config }` | 注册新目标 |
| 注销目标 | `targets.unregister` | `{ targetId }` | 注销目标 |
| 状态检查 | `targets.status` | `{ targetId? }` | 检查目标状态 |

#### OpenClaw AI API

| 操作 | Type | Payload | 描述 |
|------|------|---------|------|
| 创建会话 | `session.create` | `{ userId?, roomId? }` | 创建 AI 会话 |
| 关闭会话 | `session.close` | `{ sessionId }` | 关闭会话 |
| 聊天补全 | `chat.completion` | `{ messages, sessionId?, stream? }` | AI 聊天 |
| 流式补全 | `chat.completion.stream` | `{ messages, sessionId }` | 流式 AI 响应 |
| 健康检查 | `health` | `{}` | 检查服务状态 |

---

### 2.2 REST API (HTTP)

**基础路径**: `http://api.workadventure.localhost/`

#### 世界/房间 API

```
GET    /api/worlds                    # 列出世界
POST   /api/worlds                    # 创建世界
GET    /api/worlds/:worldId           # 获取世界详情
PUT    /api/worlds/:worldId           # 更新世界
DELETE /api/worlds/:worldId           # 删除世界

GET    /api/worlds/:worldId/rooms     # 列出房间
POST   /api/worlds/:worldId/rooms     # 创建房间
GET    /api/rooms/:roomId             # 获取房间详情
PUT    /api/rooms/:roomId             # 更新房间
DELETE /api/rooms/:roomId             # 删除房间

GET    /api/rooms/:roomId/instances   # 列出房间实例
POST   /api/rooms/:roomId/instances   # 创建房间实例
```

#### 技能/目标 API

```
GET    /api/skills                    # 列出技能
POST   /api/skills                    # 创建技能定义
GET    /api/skills/:skillId           # 获取技能详情
PUT    /api/skills/:skillId           # 更新技能
DELETE /api/skills/:skillId           # 删除技能

GET    /api/targets                   # 列出目标
POST   /api/targets                   # 注册目标
GET    /api/targets/:targetId         # 获取目标详情
DELETE /api/targets/:targetId         # 注销目标
```

#### 物品/区域 API

```
GET    /api/rooms/:roomId/items       # 列出房间物品
POST   /api/rooms/:roomId/items       # 创建物品
GET    /api/items/:itemId             # 获取物品详情
PUT    /api/items/:itemId             # 更新物品
DELETE /api/items/:itemId             # 删除物品

GET    /api/rooms/:roomId/zones       # 列出房间区域
POST   /api/rooms/:roomId/zones       # 创建区域
GET    /api/zones/:zoneId             # 获取区域详情
PUT    /api/zones/:zoneId             # 更新区域
DELETE /api/zones/:zoneId             # 删除区域
```

#### 事件/审计 API

```
GET    /api/events                    # 查询事件 (支持过滤)
GET    /api/events/:eventId           # 获取事件详情
POST   /api/events/replay             # 回放事件

GET    /api/audit/logs                # 查询审计日志
GET    /api/audit/tools               # 工具调用记录
```

#### OpenClaw API

```
POST   /api/openclaw/chat             # 发送 AI 聊天
GET    /api/openclaw/sessions/:id     # 获取会话信息
DELETE /api/openclaw/sessions/:id     # 关闭会话
GET    /api/openclaw/sessions/user/:userId  # 获取用户会话
GET    /health/openclaw               # OpenClaw 健康检查
```

---

### 2.3 gRPC API (内部服务通信)

**端口**: 50051

```protobuf
service RoomService {
  rpc JoinRoom(JoinRoomRequest) returns (stream RoomEvent);
  rpc LeaveRoom(LeaveRoomRequest) returns (LeaveRoomResponse);
  rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
}

service SkillService {
  rpc ExecuteSkill(ExecuteSkillRequest) returns (stream SkillExecutionEvent);
  rpc InstallSkill(InstallSkillRequest) returns (InstallSkillResponse);
  rpc UninstallSkill(UninstallSkillRequest) returns (UninstallSkillResponse);
}

service TargetService {
  rpc RegisterTarget(RegisterTargetRequest) returns (RegisterTargetResponse);
  rpc UnregisterTarget(UnregisterTargetRequest) returns (UnregisterTargetResponse);
  rpc CheckStatus(CheckStatusRequest) returns (CheckStatusResponse);
}
```

---

## 3. 错误码定义

```typescript
enum ErrorCode {
  // 通用错误 (1xxx)
  INVALID_REQUEST = 'E1000',
  UNAUTHORIZED = 'E1001',
  FORBIDDEN = 'E1002',
  NOT_FOUND = 'E1003',
  RATE_LIMITED = 'E1004',
  INTERNAL_ERROR = 'E1005',

  // 房间错误 (2xxx)
  ROOM_NOT_FOUND = 'E2000',
  ROOM_FULL = 'E2001',
  ROOM_INSTANCE_UNAVAILABLE = 'E2002',

  // 技能错误 (3xxx)
  SKILL_NOT_FOUND = 'E3000',
  SKILL_NOT_INSTALLED = 'E3001',
  SKILL_EXECUTION_FAILED = 'E3002',
  SKILL_PERMISSION_DENIED = 'E3003',

  // 工具错误 (4xxx)
  TOOL_NOT_FOUND = 'E4000',
  TOOL_CALL_FAILED = 'E4001',
  TOOL_RATE_LIMITED = 'E4002',
  TOOL_RISK_DENIED = 'E4003',

  // 目标错误 (5xxx)
  TARGET_NOT_FOUND = 'E5000',
  TARGET_OFFLINE = 'E5001',
  TARGET_REGISTRATION_FAILED = 'E5002',
}
```

---

## 4. 下一步

1. **配置规范文档** - Room/Item/Zone/Skill/Tool/Policy 的 YAML/JSON 配置格式
2. **部署拓扑** - K8s/HPA、分片规则、实例化策略
3. **实现 Phase 1** - 基础事件总线和 API 端点

---

*文档版本: 1.0.0*
*最后更新: 2026-03-05*
