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
    | 'pong';

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
