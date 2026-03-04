/**
 * OpenClaw Gateway client library for WorkAdventure
 *
 * This library provides a WebSocket client for communicating with
 * the OpenClaw Gateway, enabling AI chat functionality in WorkAdventure.
 */

// Types
export type {
    OpenClawConfig,
    ConnectionStatus,
    MessageRole,
    OpenClawMessage,
    ChatCompletionRequest,
    ChatCompletionChunk,
    ChatCompletionResponse,
    GatewayEventType,
    GatewayEvent,
    WSMessageType,
    WSMessage,
    WSResponse,
    SessionInfo,
    HealthCheckResponse,
    // Skill types
    SkillType,
    SkillExecutionMode,
    SkillPermissionType,
    SkillPermission,
    SkillConfigFieldType,
    SkillConfigField,
    MCPConfig,
    ProjectConfig,
    APIConfig,
    Skill,
    SkillsListPayload,
    SkillsInfoPayload,
    SkillsInstallPayload,
    SkillsUninstallPayload,
    SkillsExecutePayload,
    SkillInfoResponse,
    SkillsListResponse,
    SkillInstallResponse,
    SkillUninstallResponse,
    SkillExecuteResponse,
    // Target types
    TargetType,
    TargetStatus,
    SkillTarget,
    DeviceTargetConfig,
    VirtualAreaTargetConfig,
    ExternalAPITargetConfig,
    OpenProjectTargetConfig,
    DeviceTarget,
    VirtualAreaTarget,
    ExternalAPITarget,
    OpenProjectTarget,
    TargetsListPayload,
    TargetsRegisterPayload,
    TargetsUnregisterPayload,
    TargetsStatusPayload,
    TargetsListResponse,
    TargetRegisterResponse,
    TargetStatusResponse,
    // World event types
    WorldEventType,
    EventActorType,
    EventActor,
    EventContext,
    WorldEvent,
} from './types';

export { DEFAULT_CONFIG } from './types';

// Client
export { GatewayClient, type GatewayClientEvents } from './GatewayClient';

// Message utilities
export { MessageBuilder, MessageParser, generateRequestId, generateSessionId } from './MessageBuilder';
