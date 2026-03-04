/**
 * OpenClaw Gateway client type definitions
 */

/**
 * Configuration for OpenClaw Gateway connection
 */
export interface OpenClawConfig {
    /** Gateway WebSocket URL (e.g., ws://127.0.0.1:18789) */
    gatewayUrl: string;
    /** API key for authentication (optional) */
    apiKey?: string;
    /** Default model to use for completions */
    defaultModel?: string;
    /** Connection timeout in milliseconds */
    timeout?: number;
    /** Enable debug logging */
    debug?: boolean;
    /** Reconnection settings */
    reconnect?: {
        enabled: boolean;
        maxAttempts: number;
        delayMs: number;
        backoffMultiplier?: number;
    };
}

/**
 * Connection status of the Gateway client
 */
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

/**
 * Role of a message in the conversation
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * A single message in the conversation
 */
export interface OpenClawMessage {
    /** Role of the message author */
    role: MessageRole;
    /** Content of the message */
    content: string;
    /** Optional name for the message author */
    name?: string;
}

/**
 * Request to create a chat completion
 */
export interface ChatCompletionRequest {
    /** Model to use for completion */
    model?: string;
    /** List of messages in the conversation */
    messages: OpenClawMessage[];
    /** Session ID for conversation continuity */
    sessionId?: string;
    /** User ID for tracking */
    userId?: string;
    /** Room ID for context */
    roomId?: string;
    /** Maximum tokens to generate */
    maxTokens?: number;
    /** Temperature for sampling (0-2) */
    temperature?: number;
    /** System prompt to prepend */
    systemPrompt?: string;
    /** Stream the response */
    stream?: boolean;
}

/**
 * Response chunk for streaming responses
 */
export interface ChatCompletionChunk {
    /** Unique ID for this response */
    id: string;
    /** Session ID for conversation continuity */
    sessionId: string;
    /** Content delta (partial content) */
    delta?: string;
    /** Full content (for non-streaming) */
    content?: string;
    /** Whether this is the final chunk */
    finished: boolean;
    /** Model used for completion */
    model?: string;
    /** Usage statistics (in final chunk) */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Error message if any */
    error?: string;
}

/**
 * Complete chat completion response (non-streaming)
 */
export interface ChatCompletionResponse {
    /** Unique ID for this response */
    id: string;
    /** Session ID for conversation continuity */
    sessionId: string;
    /** Generated content */
    content: string;
    /** Model used for completion */
    model: string;
    /** Usage statistics */
    usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    /** Timestamp of the response */
    created: number;
}

/**
 * Gateway event types
 */
export type GatewayEventType =
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'message'
    | 'chunk'
    | 'session_created'
    | 'session_closed';

/**
 * Gateway event payload
 */
export interface GatewayEvent {
    type: GatewayEventType;
    payload?: unknown;
    timestamp: number;
}

/**
 * WebSocket message types for OpenClaw Gateway
 */
export type WSMessageType =
    | 'chat.completion'
    | 'chat.completion.stream'
    | 'session.create'
    | 'session.close'
    | 'session.list'
    | 'health'
    | 'ping'
    | 'pong'
    // Skills message types
    | 'skills.list'
    | 'skills.info'
    | 'skills.install'
    | 'skills.uninstall'
    | 'skills.execute'
    | 'skills.categories'
    // Targets message types
    | 'targets.list'
    | 'targets.register'
    | 'targets.unregister'
    | 'targets.status';

// ============================================================================
// SKILL TYPE DEFINITIONS
// ============================================================================

/**
 * Skill type classification
 */
export type SkillType = 'npm' | 'mcp' | 'script' | 'project' | 'api';

/**
 * Skill execution mode
 */
export type SkillExecutionMode = 'server' | 'agent' | 'hybrid';

/**
 * Permission types for skills
 */
export type SkillPermissionType = 'file-system' | 'network' | 'shell' | 'device' | 'mcp' | 'api';

/**
 * Skill permission definition
 */
export interface SkillPermission {
    type: SkillPermissionType;
    description: string;
    required: boolean;
}

/**
 * Skill configuration field types
 */
export type SkillConfigFieldType = 'string' | 'number' | 'boolean' | 'select' | 'json';

/**
 * Skill configuration field definition
 */
export interface SkillConfigField {
    key: string;
    label: string;
    type: SkillConfigFieldType;
    required: boolean;
    default?: unknown;
    description?: string;
    options?: { value: string; label: string }[]; // For select type
}

/**
 * MCP server configuration
 */
export interface MCPConfig {
    command: string;
    args?: string[];
    env?: Record<string, string>;
}

/**
 * Project configuration for open-source skills
 */
export interface ProjectConfig {
    repoUrl: string;
    branch?: string;
    entrypoint: string;
}

/**
 * API configuration for external API skills
 */
export interface APIConfig {
    baseUrl: string;
    authType?: 'none' | 'api-key' | 'oauth2' | 'bearer';
    authConfig?: Record<string, string>;
}

/**
 * Complete Skill definition
 */
export interface Skill {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    category: string;
    icon: string;

    // Skill type and configuration
    type: SkillType;
    npmPackage?: string;
    mcpConfig?: MCPConfig;
    scriptUrl?: string;
    projectConfig?: ProjectConfig;
    apiConfig?: APIConfig;

    // Execution mode
    executionMode: SkillExecutionMode;

    // Permissions and configuration
    permissions: SkillPermission[];
    configFields?: SkillConfigField[];

    // Status
    installed: boolean;
    installPath?: string;
}

/**
 * Skill list request payload
 */
export interface SkillsListPayload {
    category?: string;
    installed?: boolean;
}

/**
 * Skill info request payload
 */
export interface SkillsInfoPayload {
    skillId: string;
}

/**
 * Skill install request payload
 */
export interface SkillsInstallPayload {
    skillId: string;
    version?: string;
    userConfig?: Record<string, unknown>;
    targetBindings?: string[];
    grantedPermissions?: string[];
}

/**
 * Skill uninstall request payload
 */
export interface SkillsUninstallPayload {
    skillId: string;
}

/**
 * Skill execute request payload
 */
export interface SkillsExecutePayload {
    skillId: string;
    targetId?: string;
    parameters?: Record<string, unknown>;
    sessionId?: string;
    executionMode?: SkillExecutionMode;
}

/**
 * Skill response types
 */
export interface SkillInfoResponse {
    skill: Skill;
}

export interface SkillsListResponse {
    skills: Skill[];
    categories: string[];
}

export interface SkillInstallResponse {
    skill: Skill;
    installPath: string;
    success: boolean;
    message?: string;
}

export interface SkillUninstallResponse {
    skillId: string;
    success: boolean;
    message?: string;
}

export interface SkillExecuteResponse {
    executionId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    output?: unknown;
    error?: string;
    executionTime?: number;
    targetId?: string;
    logs?: string[];
}

// ============================================================================
// TARGET TYPE DEFINITIONS
// ============================================================================

/**
 * Target type classification
 */
export type TargetType = 'device' | 'virtual-area' | 'external-api' | 'open-project';

/**
 * Target status
 */
export type TargetStatus = 'online' | 'offline' | 'unknown' | 'error';

/**
 * Base Target definition
 */
export interface SkillTarget {
    id: string;
    name: string;
    type: TargetType;
    icon: string;
    description?: string;
    config: Record<string, unknown>;
    status: TargetStatus;
    lastChecked?: number;
    boundSkills?: string[];
}

/**
 * Device target configuration
 */
export interface DeviceTargetConfig {
    ipAddress?: string;
    port?: number;
    agentId?: string;
    osType?: 'windows' | 'linux' | 'macos';
}

/**
 * Virtual area target configuration
 */
export interface VirtualAreaTargetConfig {
    roomSlug: string;
    areaName: string;
    mapUrl?: string;
}

/**
 * External API target configuration
 */
export interface ExternalAPITargetConfig {
    baseUrl: string;
    authType: 'none' | 'api-key' | 'oauth2' | 'bearer';
    credentials?: Record<string, string>;
}

/**
 * Open project target configuration
 */
export interface OpenProjectTargetConfig {
    repoUrl: string;
    branch?: string;
    defaultBranch?: string;
}

/**
 * Device target
 */
export interface DeviceTarget extends SkillTarget {
    type: 'device';
    config: DeviceTargetConfig;
}

/**
 * Virtual area target
 */
export interface VirtualAreaTarget extends SkillTarget {
    type: 'virtual-area';
    config: VirtualAreaTargetConfig;
}

/**
 * External API target
 */
export interface ExternalAPITarget extends SkillTarget {
    type: 'external-api';
    config: ExternalAPITargetConfig;
}

/**
 * Open project target
 */
export interface OpenProjectTarget extends SkillTarget {
    type: 'open-project';
    config: OpenProjectTargetConfig;
}

/**
 * Target list request payload
 */
export interface TargetsListPayload {
    type?: TargetType;
    status?: TargetStatus;
}

/**
 * Target register request payload
 */
export interface TargetsRegisterPayload {
    name: string;
    type: TargetType;
    icon?: string;
    description?: string;
    config: Record<string, unknown>;
}

/**
 * Target unregister request payload
 */
export interface TargetsUnregisterPayload {
    targetId: string;
}

/**
 * Target status check payload
 */
export interface TargetsStatusPayload {
    targetId?: string;
}

/**
 * Target response types
 */
export interface TargetsListResponse {
    targets: SkillTarget[];
}

export interface TargetRegisterResponse {
    target: SkillTarget;
    success: boolean;
    message?: string;
}

export interface TargetStatusResponse {
    targetId: string;
    status: TargetStatus;
    lastChecked: number;
    details?: Record<string, unknown>;
}

// ============================================================================
// WORLD EVENT DEFINITIONS
// ============================================================================

/**
 * Event type enumeration for world events
 */
export type WorldEventType =
    | 'room.join' | 'room.leave' | 'room.create' | 'room.instance.split'
    | 'zone.enter' | 'zone.leave' | 'zone.trigger'
    | 'item.click' | 'item.pickup' | 'item.use'
    | 'skill.use.requested' | 'skill.use.started' | 'skill.use.completed' | 'skill.use.failed'
    | 'npc.talk' | 'npc.interact'
    | 'tool.call.started' | 'tool.call.succeeded' | 'tool.call.failed'
    | 'world.state.updated';

/**
 * Actor type in events
 */
export type EventActorType = 'user' | 'system' | 'npc' | 'flow';

/**
 * Event actor definition
 */
export interface EventActor {
    type: EventActorType;
    id: string;
    role?: string;
}

/**
 * Event context definition
 */
export interface EventContext {
    orgId?: string;
    projectId?: string;
    roomId: string;
    instanceId?: string;
    zoneId?: string;
}

/**
 * World event structure
 */
export interface WorldEvent {
    event_id: string;
    ts: number;
    version: string;
    trace_id: string;
    actor: EventActor;
    context: EventContext;
    type: WorldEventType;
    payload: Record<string, unknown>;
}

/**
 * WebSocket message structure
 */
export interface WSMessage<T = unknown> {
    /** Message type */
    type: WSMessageType;
    /** Unique request ID for correlation */
    requestId: string;
    /** Message payload */
    payload: T;
    /** Timestamp */
    timestamp?: number;
}

/**
 * WebSocket response structure
 */
export interface WSResponse<T = unknown> {
    /** Message type */
    type: WSMessageType;
    /** Request ID this response correlates to */
    requestId: string;
    /** Success flag */
    success: boolean;
    /** Response payload */
    payload?: T;
    /** Error message if not successful */
    error?: string;
    /** Timestamp */
    timestamp: number;
}

/**
 * Session information
 */
export interface SessionInfo {
    /** Session ID */
    sessionId: string;
    /** User ID associated with session */
    userId?: string;
    /** Room ID associated with session */
    roomId?: string;
    /** Creation timestamp */
    createdAt: number;
    /** Last activity timestamp */
    lastActivityAt: number;
    /** Message count in session */
    messageCount: number;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
    /** Gateway status */
    status: 'healthy' | 'unhealthy';
    /** Connected backend providers */
    providers: string[];
    /** Gateway version */
    version?: string;
    /** Uptime in seconds */
    uptime?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Partial<OpenClawConfig> = {
    timeout: 30000,
    debug: false,
    defaultModel: 'glm-5',
    reconnect: {
        enabled: true,
        maxAttempts: 5,
        delayMs: 1000,
        backoffMultiplier: 2,
    },
};
