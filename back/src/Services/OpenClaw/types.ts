/**
 * OpenClaw backend service types
 */

/**
 * OpenClaw Gateway configuration
 */
export interface OpenClawGatewayConfig {
    enabled: boolean;
    gatewayUrl: string;
    apiKey?: string;
    defaultModel: string;
}

/**
 * Chat completion request from client
 */
export interface ChatCompletionClientRequest {
    messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }>;
    sessionId?: string;
    userId?: string;
    roomId?: string;
    systemPrompt?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

/**
 * Chat completion response to client
 */
export interface ChatCompletionClientResponse {
    id: string;
    sessionId: string;
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    created: number;
}

/**
 * Session info
 */
export interface SessionInfo {
    sessionId: string;
    userId?: string;
    roomId?: string;
    createdAt: number;
    lastActivityAt: number;
    messageCount: number;
}

/**
 * Health check response
 */
export interface OpenClawHealthResponse {
    status: "healthy" | "unhealthy" | "disabled";
    connected: boolean;
    providers?: string[];
    version?: string;
    uptime?: number;
}

/**
 * WebSocket message to OpenClaw Gateway
 */
export interface GatewayWSMessage<T = unknown> {
    type: string;
    requestId: string;
    payload: T;
    timestamp?: number;
}

/**
 * WebSocket response from OpenClaw Gateway
 */
export interface GatewayWSResponse<T = unknown> {
    type: string;
    requestId: string;
    success: boolean;
    payload?: T;
    error?: string;
    timestamp: number;
}
