# WorkAdventure 世界平台架构规划

> 基于 "未来可持续、可演进、可运营" 的架构蓝图

## 架构分层

```
┌─────────────────────────────────────────────────────────────────┐
│                    L0 体验层：WorkAdventure                       │
│  地图渲染 │ 移动/碰撞 │ 房间切换 │ iframe UI 扩展                    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    L1 世界平台层：World Platform                  │
│  Room/Shard/Instance │ Entity System │ Rule Engine │ Event Bus   │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    L2 能力编排层：OpenClaw Orchestration           │
│  事件处理 → 推理 → 工具选择 → 执行 → 结果回写                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    L3 工具接入层：MCP Tool Fabric                  │
│  Tool Registry │ Tool Gateway │ MCP Servers                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 阶段一：基础能力建设（当前）

### 1.1 OpenClaw Gateway 集成 ✅
- [x] 类型定义导出修复
- [ ] 部署 OpenClaw Gateway 容器
- [ ] 配置 GLM-5 模型接入
- [ ] WebSocket 连接测试

### 1.2 Skills 系统基础
- [ ] Skills UI 面板完善
- [ ] Skills 安装/卸载流程
- [ ] Skills 执行引擎

### 1.3 Targets 系统
- [ ] Targets 注册/管理
- [ ] 虚拟区域 Target
- [ ] 设备 Target

---

## 阶段二：世界平台核心

### 2.1 事件系统 (Event Bus)
```typescript
interface WorldEvent {
  event_id: string;
  ts: number;
  version: string;
  trace_id: string;
  actor: EventActor;
  context: EventContext;
  type: WorldEventType;
  payload: Record<string, unknown>;
}
```

### 2.2 统一能力模型 (Ability System)
```typescript
interface Ability {
  id: string;
  trigger: Trigger;      // click/enter/command/schedule
  policy: Policy;        // 权限/频率/风险等级
  action: Action;        // WorldAction | ToolAction | FlowAction
}

type Carrier = 'avatar' | 'item' | 'zone' | 'npc';
```

### 2.3 世界图谱 (World Graph)
```typescript
interface WorldNode {
  id: string;
  type: 'room-template' | 'room-instance';
  mapUrl: string;
  edges: WorldEdge[];
}

interface WorldEdge {
  from: string;
  to: string;
  type: 'door' | 'portal' | 'corridor';
}
```

---

## 阶段三：MCP 工具生态

### 3.1 MCP Gateway
- 统一鉴权
- 限流/配额
- 审计日志
- 脱敏处理

### 3.2 MCP Server 规划
| Server | 功能 | 风险等级 |
|--------|------|----------|
| mcp-kb | 知识库检索 | low |
| mcp-ticket | 工单/项目管理 | medium |
| mcp-ci | 部署/构建 | high |
| mcp-doc | 文档生成 | low |
| mcp-data | 数据查询 | high |

---

## 阶段四：可扩展架构

### 4.1 房间分片 (Room Sharding)
- consistent hash 分配
- 热点房间自动实例化
- 跨实例状态同步

### 4.2 动态生成器 (Room Generator)
- 模板库管理
- 参数化生成
- CDN 发布

### 4.3 权限治理
- RBAC + ABAC 模型
- Zone 策略边界
- 审计与合规

---

## 实施优先级

| 优先级 | 任务 | 预估时间 |
|--------|------|----------|
| P0 | OpenClaw Gateway 部署 | 1-2 天 |
| P0 | Skills UI 完善 | 2-3 天 |
| P1 | 事件总线实现 | 3-5 天 |
| P1 | Ability 模型定义 | 2-3 天 |
| P2 | MCP Gateway | 5-7 天 |
| P2 | 第一个 MCP Server | 3-5 天 |
| P3 | 世界图谱 | 5-7 天 |
| P3 | 房间分片 | 7-10 天 |

---

## 下一步行动

1. **输出事件 Schema + API 清单**
2. **输出配置规范（YAML/JSON）**
3. **输出部署拓扑与扩容策略**

---

*文档版本: 1.0.0*
*最后更新: 2026-03-05*
