/**
 * OpenClaw Gateway service
 * Manages WebSocket connection to OpenClaw Gateway
 */

import WebSocket from "ws";
import { v4 as uuidv4 } from "uuid";
import type {
    OpenClawGatewayConfig,
    ChatCompletionClientRequest,
    ChatCompletionClientResponse,
    GatewayWSMessage,
    GatewayWSResponse,
    OpenClawHealthResponse,
} from "./types";
import { openClawSessionManager } from "./OpenClawSessionManager";

/**
 * Pending request tracker
 */
interface PendingRequest {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
}

export class OpenClawGatewayService {
    private ws: WebSocket | null = null;
    private config: OpenClawGatewayConfig;
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private connectionState: "disconnected" | "connecting" | "connected" | "error" = "disconnected";
    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;
    private startTime = Date.now();

    constructor(config: OpenClawGatewayConfig) {
        this.config = config;
    }

    /**
     * Check if OpenClaw is enabled
     */
    isEnabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Get connection state
     */
    getConnectionState(): string {
        return this.connectionState;
    }

    /**
     * Connect to OpenClaw Gateway
     */
    async connect(): Promise<void> {
        if (!this.config.enabled) {
            throw new Error("OpenClaw is disabled");
        }

        if (this.ws && this.connectionState === "connected") {
            return;
        }

        this.connectionState = "connecting";

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.config.gatewayUrl);

                this.ws.onopen = () => {
                    console.log("Connected to OpenClaw Gateway:", this.config.gatewayUrl);
                    this.connectionState = "connected";
                    this.reconnectAttempts = 0;
                    this.startPingInterval();
                    resolve();
                };

                this.ws.onclose = (event) => {
                    console.log("Disconnected from OpenClaw Gateway:", event.code);
                    this.handleDisconnect();
                };

                this.ws.onerror = (error) => {
                    console.error("OpenClaw Gateway error:", error);
                    if (this.connectionState === "connecting") {
                        reject(new Error("Failed to connect to OpenClaw Gateway"));
                    }
                    this.connectionState = "error";
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data as string);
                };
            } catch (error) {
                this.connectionState = "error";
                reject(error);
            }
        });
    }

    /**
     * Disconnect from gateway
     */
    async disconnect(): Promise<void> {
        this.stopPingInterval();
        this.stopReconnect();

        if (this.ws) {
            this.ws.close(1000, "Server shutdown");
            this.ws = null;
        }

        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection closed"));
            this.pendingRequests.delete(requestId);
        }

        this.connectionState = "disconnected";
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.connectionState === "connected" && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Send chat completion request
     */
    async sendChatCompletion(
        request: ChatCompletionClientRequest
    ): Promise<ChatCompletionClientResponse> {
        if (!this.isConnected()) {
            await this.connect();
        }

        const requestId = uuidv4();
        let sessionId = request.sessionId;

        // Create or get session
        if (!sessionId) {
            const session = openClawSessionManager.createSession(
                request.userId,
                request.roomId
            );
            sessionId = session.sessionId;
        }

        // Build messages array
        const messages = [...(request.messages || [])];

        // Add system prompt if provided
        if (request.systemPrompt) {
            messages.unshift({
                role: "system",
                content: request.systemPrompt,
            });
        }

        // Store messages in session
        for (const msg of request.messages || []) {
            openClawSessionManager.addMessage(sessionId, msg.role, msg.content);
        }

        // Send request to gateway
        const message: GatewayWSMessage = {
            type: "chat.completion",
            requestId,
            payload: {
                messages,
                sessionId,
                model: request.model || this.config.defaultModel,
                maxTokens: request.maxTokens,
                temperature: request.temperature,
            },
            timestamp: Date.now(),
        };

        const response = await this.sendRequest<ChatCompletionClientResponse>(message, requestId);

        // Store assistant response
        if (response.content) {
            openClawSessionManager.addMessage(sessionId, "assistant", response.content);
        }

        return response;
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<OpenClawHealthResponse> {
        if (!this.config.enabled) {
            return {
                status: "disabled",
                connected: false,
            };
        }

        if (!this.isConnected()) {
            return {
                status: "unhealthy",
                connected: false,
            };
        }

        try {
            const requestId = uuidv4();
            const message: GatewayWSMessage = {
                type: "health",
                requestId,
                payload: {},
                timestamp: Date.now(),
            };

            const response = await this.sendRequest<{
                status: string;
                providers?: string[];
                version?: string;
            }>(message, requestId);

            return {
                status: response.status === "healthy" ? "healthy" : "unhealthy",
                connected: true,
                providers: response.providers,
                version: response.version,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
            };
        } catch (error) {
            return {
                status: "unhealthy",
                connected: true,
                uptime: Math.floor((Date.now() - this.startTime) / 1000),
            };
        }
    }

    /**
     * Send a request and wait for response
     */
    private sendRequest<T>(message: GatewayWSMessage, requestId: string): Promise<T> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error("Request timeout"));
            }, 30000);

            this.pendingRequests.set(requestId, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timeout,
            });

            try {
                const data = JSON.stringify(message);
                this.ws?.send(data);
            } catch (error) {
                this.pendingRequests.delete(requestId);
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const parsed = JSON.parse(data) as GatewayWSResponse;

            if (parsed.type === "pong") {
                return;
            }

            const pending = this.pendingRequests.get(parsed.requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(parsed.requestId);

                if (!parsed.success || parsed.error) {
                    pending.reject(new Error(parsed.error || "Unknown error"));
                } else {
                    pending.resolve(parsed.payload);
                }
            }
        } catch (error) {
            console.error("Failed to parse OpenClaw message:", error);
        }
    }

    /**
     * Handle WebSocket disconnect
     */
    private handleDisconnect(): void {
        this.stopPingInterval();
        const wasConnected = this.connectionState === "connected";
        this.connectionState = "disconnected";
        this.ws = null;

        if (wasConnected && this.reconnectAttempts < 5) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule reconnection
     */
    private scheduleReconnect(): void {
        const delay = 1000 * Math.pow(2, this.reconnectAttempts);
        console.log(`Scheduling OpenClaw reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                console.error("OpenClaw reconnect failed:", error);
            });
        }, delay);
    }

    /**
     * Stop reconnection
     */
    private stopReconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
    }

    /**
     * Start ping interval
     */
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            if (this.isConnected()) {
                this.ws?.send(JSON.stringify({
                    type: "ping",
                    requestId: uuidv4(),
                    timestamp: Date.now(),
                }));
            }
        }, 30000);
    }

    /**
     * Stop ping interval
     */
    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Destroy the service
     */
    async destroy(): Promise<void> {
        await this.disconnect();
    }
}

// Environment variables for configuration
const OPENCLAW_ENABLED = process.env.OPENCLAW_ENABLED === "true";
const OPENCLAW_GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";
const OPENCLAW_API_KEY = process.env.OPENCLAW_API_KEY;
const OPENCLAW_DEFAULT_MODEL = process.env.OPENCLAW_DEFAULT_MODEL || "glm-5";

// LLM Provider configuration (for direct API calls or gateway config)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Singleton instance
export const openClawGatewayService = new OpenClawGatewayService({
    enabled: OPENCLAW_ENABLED,
    gatewayUrl: OPENCLAW_GATEWAY_URL,
    apiKey: OPENCLAW_API_KEY,
    defaultModel: OPENCLAW_DEFAULT_MODEL,
});
