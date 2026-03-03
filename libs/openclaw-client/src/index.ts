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
} from './types';

export { DEFAULT_CONFIG } from './types';

// Client
export { GatewayClient, type GatewayClientEvents } from './GatewayClient';

// Message utilities
export { MessageBuilder, MessageParser, generateRequestId, generateSessionId } from './MessageBuilder';
