/**
 * OpenClaw connection manager for WorkAdventure
 */

import Debug from "debug";
import { writable, readable, get, type Readable, type Writable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
import type {
    ChatConnectionInterface,
    ChatRoom,
    ChatRoomMembershipManagement,
    AnyKindOfUser,
    ConnectionStatus,
    CreateRoomOptions,
} from "../ChatConnection";
import { OpenClawChatRoom } from "./OpenClawChatRoom";
import type { OpenClawConnectionState, OpenClawSettings, OpenClawRoomConfig } from "./OpenClawTypes";
import {
    OPENCLAW_ENABLED,
    OPENCLAW_GATEWAY_URL,
    OPENCLAW_API_KEY,
    OPENCLAW_DEFAULT_MODEL,
    OPENCLAW_TRIGGER_PREFIX,
} from "../../../Enum/EnvironmentVariable";
import type { PictureStore } from "../../../Stores/PictureStore";
import type { AvailabilityStatus } from "@workadventure/messages";

const debug = Debug("OpenClaw:Connection");

/**
 * Chat message request
 */
interface ChatMessageRequest {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    sessionId?: string;
    systemPrompt?: string;
    model?: string;
}

/**
 * Chat message response
 */
interface ChatMessageResponse {
    id: string;
    sessionId: string;
    content: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * OpenClaw connection manager
 */
export class OpenClawConnection {
    private ws: WebSocket | null = null;
    private connectionState: Writable<OpenClawConnectionState> = writable("disconnected");
    private rooms: Map<string, OpenClawChatRoom> = new Map();
    private pendingRequests: Map<string, {
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
        timeout: ReturnType<typeof setTimeout>;
    }> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    private pingInterval: ReturnType<typeof setInterval> | null = null;

    private readonly settings: OpenClawSettings;
    private readonly defaultAIUser: AnyKindOfUser;

    constructor() {
        this.settings = {
            enabled: OPENCLAW_ENABLED,
            gatewayUrl: OPENCLAW_GATEWAY_URL,
            apiKey: OPENCLAW_API_KEY,
            defaultModel: OPENCLAW_DEFAULT_MODEL,
            triggerPrefix: OPENCLAW_TRIGGER_PREFIX,
        };

        // Default AI user for all AI interactions
        this.defaultAIUser = {
            chatId: "ai-assistant",
            uuid: "ai-assistant",
            availabilityStatus: readable("ONLINE" as unknown as AvailabilityStatus),
            username: "AI Assistant",
            pictureStore: readable(undefined),
            roomName: undefined,
            playUri: undefined,
            isAdmin: false,
            isMember: false,
            color: undefined,
            spaceUserId: undefined,
        };

        debug("OpenClaw connection initialized with settings: %O", this.settings);
    }

    /**
     * Check if OpenClaw is enabled
     */
    isEnabled(): boolean {
        return this.settings.enabled;
    }

    /**
     * Get the trigger prefix for AI messages
     */
    getTriggerPrefix(): string {
        return this.settings.triggerPrefix;
    }

    /**
     * Check if a message should trigger AI
     */
    shouldTriggerAI(message: string): boolean {
        if (!this.settings.enabled) return false;
        return message.trim().startsWith(this.settings.triggerPrefix);
    }

    /**
     * Extract the actual message content (remove trigger prefix)
     */
    extractMessageContent(message: string): string {
        const prefix = this.settings.triggerPrefix;
        if (message.trim().startsWith(prefix)) {
            return message.trim().slice(prefix.length).trim();
        }
        return message;
    }

    /**
     * Get connection state
     */
    getConnectionState(): Readable<OpenClawConnectionState> {
        return this.connectionState;
    }

    /**
     * Connect to the OpenClaw gateway
     */
    async connect(): Promise<void> {
        if (!this.settings.enabled) {
            debug("OpenClaw is disabled, skipping connection");
            return;
        }

        if (this.ws && get(this.connectionState) === "connected") {
            debug("Already connected");
            return;
        }

        this.connectionState.set("connecting");
        debug("Connecting to OpenClaw gateway: %s", this.settings.gatewayUrl);

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.settings.gatewayUrl);

                this.ws.onopen = () => {
                    debug("Connected to OpenClaw gateway");
                    this.connectionState.set("connected");
                    this.reconnectAttempts = 0;
                    this.startPingInterval();
                    resolve();
                };

                this.ws.onclose = (event) => {
                    debug("Connection closed: %d", event.code);
                    this.handleDisconnect();
                };

                this.ws.onerror = (event) => {
                    debug("Connection error: %o", event);
                    const error = new Error("WebSocket connection error");
                    if (get(this.connectionState) === "connecting") {
                        reject(error);
                    }
                    this.connectionState.set("error");
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };
            } catch (error) {
                this.connectionState.set("error");
                reject(error);
            }
        });
    }

    /**
     * Disconnect from the gateway
     */
    async disconnect(): Promise<void> {
        debug("Disconnecting from OpenClaw gateway");
        this.stopPingInterval();
        this.stopReconnect();

        if (this.ws) {
            this.ws.close(1000, "Client disconnect");
            this.ws = null;
        }

        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error("Connection closed"));
            this.pendingRequests.delete(requestId);
        }

        this.connectionState.set("disconnected");
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return get(this.connectionState) === "connected" && this.ws?.readyState === WebSocket.OPEN;
    }

    /**
     * Create or get an AI chat room
     */
    createAIChatRoom(
        roomId: string,
        name: string,
        currentUser: AnyKindOfUser,
        pictureStore: PictureStore,
        config?: Partial<OpenClawRoomConfig>
    ): OpenClawChatRoom {
        let room = this.rooms.get(roomId);

        if (!room) {
            room = new OpenClawChatRoom(
                this,
                {
                    id: roomId,
                    name,
                    type: "ai-assistant",
                    ...config,
                },
                currentUser,
                pictureStore
            );
            this.rooms.set(roomId, room);
        }

        return room;
    }

    /**
     * Get an existing AI chat room
     */
    getAIChatRoom(roomId: string): OpenClawChatRoom | undefined {
        return this.rooms.get(roomId);
    }

    /**
     * Get the default AI user
     */
    getDefaultAIUser(): AnyKindOfUser {
        return this.defaultAIUser;
    }

    /**
     * Send a chat message to the gateway
     */
    async sendChatMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
        if (!this.isConnected()) {
            throw new Error("Not connected to OpenClaw gateway");
        }

        const requestId = uuidv4();
        const message = {
            type: "chat.completion",
            requestId,
            payload: {
                ...request,
                model: request.model ?? this.settings.defaultModel,
            },
            timestamp: Date.now(),
        };

        return this.sendRequest<ChatMessageResponse>(message, requestId);
    }

    /**
     * Send a request and wait for response
     */
    private sendRequest<T>(message: unknown, requestId: string): Promise<T> {
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
                debug("Sending: %s", data);
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
        debug("Received: %s", data);

        try {
            const parsed = JSON.parse(data);

            // Handle pong responses
            if (parsed.type === "pong") {
                return;
            }

            // Check if this is a response to a pending request
            const pending = this.pendingRequests.get(parsed.requestId);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(parsed.requestId);

                if (parsed.payload?.error) {
                    pending.reject(new Error(parsed.payload.error));
                } else {
                    pending.resolve(parsed.payload);
                }
            }
        } catch (error) {
            debug("Failed to parse message: %o", error);
        }
    }

    /**
     * Handle WebSocket disconnect
     */
    private handleDisconnect(): void {
        this.stopPingInterval();
        this.connectionState.set("disconnected");
        this.ws = null;

        // Attempt reconnection
        if (this.reconnectAttempts < 5) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt
     */
    private scheduleReconnect(): void {
        const delay = 1000 * Math.pow(2, this.reconnectAttempts);
        debug("Scheduling reconnect in %dms (attempt %d)", delay, this.reconnectAttempts + 1);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                debug("Reconnect failed: %o", error);
            });
        }, delay);
    }

    /**
     * Stop reconnection attempts
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
                this.ws?.send(JSON.stringify({ type: "ping", requestId: uuidv4() }));
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
     * Destroy the connection and cleanup
     */
    async destroy(): Promise<void> {
        await this.disconnect();
        this.rooms.clear();
    }
}

// Singleton instance
let openClawConnection: OpenClawConnection | null = null;

/**
 * Get the OpenClaw connection singleton
 */
export function getOpenClawConnection(): OpenClawConnection {
    if (!openClawConnection) {
        openClawConnection = new OpenClawConnection();
    }
    return openClawConnection;
}
