# 配置规范 (Configuration Specification)

> 版本: 1.0.0 | 更新时间: 2026-03-05

本文档定义了世界平台所有可配置对象的 YAML/JSON 格式规范。

---

## 1. Room Template (房间模板)

### 1.1 Schema

```yaml
# room-template.yaml
apiVersion: world.workadventure/v1
kind: RoomTemplate
metadata:
  id: office-standard
  name: 标准办公室
  version: 1.0.0
  author: system
  tags:
    - office
    - standard

spec:
  # 地图配置
  map:
    # 基础地图 URL (Tiled JSON)
    baseUrl: /maps/templates/office-standard.json
    # 可变区域 (生成时替换)
    variableLayers:
      - name: furniture
        generator: random
        pool: office-furniture
      - name: npcs
        generator: rule-based
        rules: office-npc-placement

  # 房间属性
  properties:
    maxUsers: 50
    instanceThreshold: 40      # 超过此人数自动分片
    autoInstance: true
    persistentState: true      # 离开后状态保留
    theme: corporate
    lighting: day-night        # day-night | static

  # 默认区域
  zones:
    - id: entrance
      name: 入口区
      type: public
      polygon: [[0,0], [200,0], [200,100], [0,100]]
    - id: work-area
      name: 工作区
      type: office
      policy: allow-work-tools

  # 默认物品
  items:
    - template: whiteboard
      position: { x: 400, y: 200 }
    - template: terminal
      position: { x: 600, y: 300 }

  # 入口点
  entryPoints:
    - id: main-entrance
      position: { x: 100, y: 50 }
      default: true
    - id: back-entrance
      position: { x: 800, y: 400 }

  # 连接点 (用于世界图谱)
  exits:
    - id: north-exit
      position: { x: 400, y: 0 }
      direction: north
      targetZone: corridor-north
    - id: south-exit
      position: { x: 400, y: 600 }
      direction: south
      targetZone: corridor-south
```

---

## 2. Item Definition (物品定义)

### 2.1 Schema

```yaml
# item-definition.yaml
apiVersion: world.workadventure/v1
kind: ItemDefinition
metadata:
  id: terminal-devops
  name: DevOps 终端机
  version: 1.0.0
  category: tool
  icon: terminal

spec:
  # 外观
  appearance:
    sprite: /sprites/items/terminal.png
    width: 64
    height: 64
    animations:
      idle: { frames: [0], fps: 1 }
      active: { frames: [1,2,3,2], fps: 4 }

  # 交互
  interaction:
    type: click
    range: 64
    cooldown: 0

  # 能力
  abilities:
    - abilityRef: devops-deploy
      trigger: click
      label: 部署项目
      icon: rocket
    - abilityRef: devops-logs
      trigger: click+shift
      label: 查看日志
      icon: file-text

  # 生成规则
  spawn:
    purchasable: true
    cost: 1000              # 虚拟货币
    requires:
      role: developer
      zone: lab

  # 状态
  state:
    properties:
      - key: status
        type: enum
        values: [idle, deploying, error]
        default: idle
      - key: lastDeployment
        type: timestamp
        default: null
```

---

## 3. Zone Definition (区域定义)

### 3.1 Schema

```yaml
# zone-definition.yaml
apiVersion: world.workadventure/v1
kind: ZoneDefinition
metadata:
  id: lab-restricted
  name: 实验室受限区
  version: 1.0.0

spec:
  # 区域类型
  type: restricted          # public | private | restricted | event | lab

  # 视觉效果
  visual:
    fillColor: rgba(255, 0, 0, 0.1)
    strokeColor: rgba(255, 0, 0, 0.5)
    strokeWidth: 2

  # 进入规则
  entryPolicy:
    allowedRoles:
      - developer
      - admin
    requiresApproval: false
    maxOccupancy: 10

  # 策略绑定
  policies:
    - policyRef: restrict-screenshot
      enabled: true
    - policyRef: restrict-file-export
      enabled: true
    - policyRef: allow-high-risk-tools
      enabled: true

  # 区域触发器
  triggers:
    - event: zone.enter
      actions:
        - type: notify
          message: "您已进入受限区域，请注意保密"
        - type: grant-permission
          permissions: [lab-access]
    - event: zone.leave
      actions:
        - type: revoke-permission
          permissions: [lab-access]
        - type: notify
          message: "您已离开受限区域"

  # 能力 (区域内可用)
  abilities:
    - abilityRef: deploy-production
      enabled: true
      policy: require-approval

  # NPC 行为
  npcBehavior:
    guardEnabled: true
    guardMessage: "请勿在受限区进行未授权操作"
```

---

## 4. Skill Definition (技能定义)

### 4.1 Schema

```yaml
# skill-definition.yaml
apiVersion: world.workadventure/v1
kind: SkillDefinition
metadata:
  id: skill-deploy-k8s
  name: Kubernetes 部署
  description: 将项目部署到 Kubernetes 集群
  version: 1.0.0
  author: DevOps Team
  category: automation
  icon: container

spec:
  # 技能类型
  type: mcp                 # npm | mcp | script | project | api

  # MCP 配置
  mcpConfig:
    server: mcp-ci
    tool: k8s_deploy

  # 执行模式
  executionMode: server     # server | agent | hybrid

  # 权限要求
  permissions:
    - type: shell
      description: 执行部署命令
      required: true
    - type: network
      description: 访问 Kubernetes API
      required: true

  # 配置字段
  configFields:
    - key: cluster
      label: 目标集群
      type: select
      required: true
      options:
        - value: prod-asia
          label: 生产环境 (亚洲)
        - value: prod-europe
          label: 生产环境 (欧洲)
        - value: staging
          label: 预发布环境
    - key: namespace
      label: 命名空间
      type: string
      required: true
      default: default
    - key: dryRun
      label: 试运行
      type: boolean
      required: false
      default: true
    - key: replicas
      label: 副本数
      type: number
      required: false
      default: 2
      validation:
        min: 1
        max: 10

  # 目标绑定
  targetBindings:
    - targetType: open-project
      required: true
      description: 要部署的项目

  # 风险等级
  riskLevel: high

  # 执行策略
  executionPolicy:
    allowedZones: [lab, deployment-area]
    requiresApproval: true
    approverRoles: [admin, team-lead]
    cooldown: 300           # 秒

  # 事件发布
  events:
    onStart: skill.deployment.started
    onSuccess: skill.deployment.completed
    onFailure: skill.deployment.failed
```

---

## 5. Tool Definition (工具定义)

### 5.1 Schema

```yaml
# tool-definition.yaml
apiVersion: world.workadventure/v1
kind: ToolDefinition
metadata:
  id: tool-k8s-deploy
  name: Kubernetes 部署工具
  version: 1.0.0
  mcpServer: mcp-ci

spec:
  # 工具 Schema (JSON Schema)
  inputSchema:
    type: object
    required:
      - cluster
      - namespace
      - image
    properties:
      cluster:
        type: string
        enum: [prod-asia, prod-europe, staging]
      namespace:
        type: string
        pattern: "^[a-z0-9-]+$"
      image:
        type: string
        format: uri
      replicas:
        type: integer
        minimum: 1
        maximum: 10

  outputSchema:
    type: object
    properties:
      deploymentId:
        type: string
      status:
        type: string
      url:
        type: string

  # 风险等级
  riskLevel: high           # low | medium | high

  # 权限要求
  allowedRoles:
    - developer
    - admin
  allowedZones:
    - lab
    - deployment-area

  # 限流
  rateLimit:
    requests: 10
    window: 60              # 秒
    perUser: true

  # 审计
  audit:
    logInput: true
    logOutput: true
    redactFields:
      - password
      - token
      - apiKey

  # 脱敏
  redaction:
    inputPatterns:
      - pattern: "(password|token|secret)=[^&]+"
        replacement: "$1=***"
    outputPatterns:
      - pattern: "\\b\\d{4}[- ]?\\d{4}[- ]?\\d{4}[- ]?\\d{4}\\b"
        replacement: "****-****-****-****"
```

---

## 6. Policy Definition (策略定义)

### 6.1 Schema

```yaml
# policy-definition.yaml
apiVersion: world.workadventure/v1
kind: PolicyDefinition
metadata:
  id: restrict-screenshot
  name: 禁止截屏
  description: 在此区域禁止截屏功能
  version: 1.0.0

spec:
  # 策略类型
  type: restriction          # restriction | permission | behavior

  # 规则
  rules:
    - effect: deny
      action: screenshot
      condition: "zone.type == 'restricted'"

    - effect: deny
      action: clipboard.export
      condition: "zone.type == 'restricted'"

  # 强制执行
  enforcement:
    mode: strict             # strict | advisory | disabled
    notify: true
    notifyMessage: "当前区域禁止截屏"

  # 审计
  audit:
    logViolations: true
    alertOnViolation: true
    alertChannels:
      - security-team
```

---

## 7. Flow Definition (工作流定义)

### 7.1 Schema

```yaml
# flow-definition.yaml
apiVersion: world.workadventure/v1
kind: FlowDefinition
metadata:
  id: flow-new-project-setup
  name: 新项目初始化流程
  description: 创建新项目时的完整初始化流程
  version: 1.0.0

spec:
  # 触发器
  trigger:
    type: webhook
    endpoint: /webhooks/project/create
    auth: hmac-sha256

  # 步骤
  steps:
    - id: create-rooms
      name: 创建项目房间
      type: world-action
      action: generate-rooms
      params:
        template: project-suite
        variables:
          projectName: "${input.projectName}"
          teamSize: "${input.teamSize}"
      timeout: 60

    - id: create-repo
      name: 创建代码仓库
      type: tool-action
      tool: github-create-repo
      params:
        name: "${input.projectName}"
        private: true
      timeout: 30

    - id: setup-ci
      name: 配置 CI 流水线
      type: tool-action
      tool: ci-setup-pipeline
      params:
        repoUrl: "${steps.create-repo.output.url}"
        template: standard-node
      dependsOn: [create-repo]
      timeout: 30

    - id: notify-team
      name: 通知团队
      type: world-action
      action: broadcast-message
      params:
        message: "项目 ${input.projectName} 已创建完成！"
        targetZone: plaza
      dependsOn: [create-rooms, setup-ci]

  # 错误处理
  errorHandler:
    strategy: rollback
    rollbackSteps:
      - create-rooms
      - create-repo

  # 超时
  timeout: 300              # 总超时 (秒)

  # 重试
  retry:
    maxAttempts: 3
    backoff: exponential
    initialDelay: 5
```

---

## 8. Target Definition (目标定义)

### 8.1 Schema

```yaml
# target-definition.yaml
apiVersion: world.workadventure/v1
kind: TargetDefinition
metadata:
  id: target-prod-cluster
  name: 生产环境 Kubernetes 集群
  version: 1.0.0

spec:
  # 目标类型
  type: external-api         # device | virtual-area | external-api | open-project

  # 外部 API 配置
  apiConfig:
    baseUrl: https://k8s-api.company.com
    authType: bearer
    authConfig:
      tokenSecret: k8s-prod-token

  # 健康检查
  healthCheck:
    enabled: true
    interval: 30
    endpoint: /healthz
    timeout: 5

  # 绑定的技能
  boundSkills:
    - skill-deploy-k8s
    - skill-k8s-logs
    - skill-k8s-scale

  # 状态
  status:
    checkInterval: 60
    metrics:
      - cpu_usage
      - memory_usage
      - pod_count
```

---

## 9. 配置文件结构

### 9.1 目录结构

```
config/
├── world/
│   ├── world.yaml              # 世界定义
│   └── graph.yaml              # 世界图谱
├── rooms/
│   ├── templates/              # 房间模板
│   │   ├── office-standard.yaml
│   │   ├── project-suite.yaml
│   │   └── event-hall.yaml
│   └── instances/              # 运行时实例 (生成)
├── items/
│   └── definitions/
│       ├── terminal-devops.yaml
│       └── whiteboard.yaml
├── zones/
│   └── definitions/
│       ├── lab-restricted.yaml
│       └── event-public.yaml
├── skills/
│   └── definitions/
│       ├── skill-deploy-k8s.yaml
│       └── skill-translate.yaml
├── tools/
│   └── definitions/
│       ├── tool-k8s-deploy.yaml
│       └── tool-github.yaml
├── policies/
│   └── definitions/
│       ├── restrict-screenshot.yaml
│       └── allow-deploy.yaml
├── flows/
│   └── definitions/
│       ├── flow-new-project.yaml
│       └── flow-event-start.yaml
└── targets/
    └── definitions/
        ├── target-prod-cluster.yaml
        └── target-staging.yaml
```

---

## 10. 下一步

1. **实现配置加载器** - 解析 YAML 并验证 Schema
2. **实现热更新** - 配置变更无需重启服务
3. **实现版本控制** - GitOps 发布流程

---

*文档版本: 1.0.0*
*最后更新: 2026-03-05*
