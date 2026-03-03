/**
 * OpenClaw Gateway WebSocket client
 */

import Debug from 'debug';
import EventEmitter from 'eventemitter3';
import type {
    OpenClawConfig,
    ConnectionStatus,
    ChatCompletionRequest,
    ChatCompletionResponse,
    ChatCompletionChunk,
    WSMessage,
    WSResponse,
    SessionInfo,
    HealthCheckResponse,
} from './types';
import { DEFAULT_CONFIG } from './types';
import { MessageBuilder, MessageParser, generateRequestId, generateSessionId } from './MessageBuilder';

const debug = Debug('openclaw:client');

/**
 * Event types emitted by the GatewayClient
 */
export interface GatewayClientEvents {
    /** Connection status changed */
    'status:changed': (status: ConnectionStatus) => void;
    /** Received a chat completion chunk (streaming) */
    'chat:chunk': (chunk: ChatCompletionChunk) => void;
    /** Received a complete chat response */
    'chat:complete': (response: ChatCompletionResponse) => void;
    /** Received an error */
    error: (error: Error) => void;
    /** Gateway disconnected */
    disconnected: () => void;
    /** Gateway connected */
    connected: () => void;
}

/**
 * Pending request tracker
 */
interface PendingRequest<T = unknown> {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    stream?: boolean;
    accumulatedContent?: string;
}

/**
 * OpenClaw Gateway WebSocket client
 */
export class GatewayClient extends EventEmitter<GatewayClientEvents> {
    private ws: WebSocket | null = null;
    private config: Required<OpenClawConfig>;
    private status: ConnectionStatus = 'disconnected';
    private pendingRequests: Map<string, PendingRequest> = new Map();
    private reconnectAttempts = 0;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(config: OpenClawConfig) {
        super();
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            reconnect: {
                ...DEFAULT_CONFIG.reconnect!,
                ...config.reconnect,
            },
        } as Required<OpenClawConfig>;

        if (this.config.debug) {
            Debug.enable('openclaw:*');
        }
    }

    /**
     * Get current connection status
     */
    getStatus(): ConnectionStatus {
        return this.status;
    }

    /**
     * Connect to the OpenClaw Gateway
     */
    async connect(): Promise<void> {
        if (this.ws && (this.status === 'connected' || this.status === 'connecting')) {
            debug('Already connected or connecting');
            return;
        }

        this.setStatus('connecting');
        debug('Connecting to %s', this.config.gatewayUrl);

        return new Promise((resolve, reject) => {
            try {
                // Use native WebSocket in browser, or the ws package in Node.js
                const WebSocketClass = typeof WebSocket !== 'undefined'
                    ? WebSocket
                    : require('ws');

                this.ws = new WebSocketClass(this.config.gatewayUrl);

                this.ws.onopen = () => {
                    debug('WebSocket connected');
                    this.setStatus('connected');
                    this.reconnectAttempts = 0;
                    this.startPingInterval();
                    this.emit('connected');
                    resolve();
                };

                this.ws.onclose = (event: CloseEvent) => {
                    debug('WebSocket closed: %d', event.code);
                    this.handleDisconnect();
                };

                this.ws.onerror = (event: Event) => {
                    debug('WebSocket error: %o', event);
                    const error = new Error('WebSocket connection error');
                    this.emit('error', error);
                    if (this.status === 'connecting') {
                        reject(error);
                    }
                };

                this.ws.onmessage = (event: MessageEvent) => {
                    this.handleMessage(event.data);
                };
            } catch (error) {
                this.setStatus('error');
                reject(error);
            }
        });
    }

    /**
     * Disconnect from the gateway
     */
    async disconnect(): Promise<void> {
        debug('Disconnecting...');
        this.stopPingInterval();
        this.stopReconnect();

        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }

        // Reject all pending requests
        for (const [requestId, pending] of this.pendingRequests) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Connection closed'));
            this.pendingRequests.delete(requestId);
        }

        this.setStatus('disconnected');
    }

    /**
     * Check if connected to the gateway
     */
    isConnected(): boolean {
        return this.status === 'connected' && this.ws?.readyState === 1; // WebSocket.OPEN
    }

    /**
     * Send a chat completion request
     */
    async chatCompletion(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const message = MessageBuilder.chatCompletion({
            ...request,
            model: request.model ?? this.config.defaultModel,
        });

        return this.sendRequest<ChatCompletionResponse>(message);
    }

    /**
     * Send a streaming chat completion request
     * @param request Chat completion request
     * @param onChunk Callback for each chunk
     * @returns Complete response
     */
    async chatCompletionStream(
        request: ChatCompletionRequest,
        onChunk?: (chunk: ChatCompletionChunk) => void
    ): Promise<ChatCompletionResponse> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const message = MessageBuilder.chatCompletionStream({
            ...request,
            model: request.model ?? this.config.defaultModel,
        });

        return new Promise((resolve, reject) => {
            const requestId = message.requestId;
            let accumulatedContent = '';
            let response: ChatCompletionResponse | null = null;

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, this.config.timeout);

            const pending: PendingRequest = {
                resolve: (res: unknown) => resolve(res as ChatCompletionResponse),
                reject,
                timeout,
                stream: true,
                accumulatedContent: '',
            };

            this.pendingRequests.set(requestId, pending);

            // Handle chunks via event
            const chunkHandler = (chunk: ChatCompletionChunk) => {
                if (chunk.sessionId !== request.sessionId) return;

                if (chunk.delta) {
                    accumulatedContent += chunk.delta;
                    pending.accumulatedContent = accumulatedContent;
                }

                if (onChunk) {
                    onChunk(chunk);
                }

                if (chunk.finished) {
                    response = {
                        id: chunk.id,
                        sessionId: chunk.sessionId,
                        content: accumulatedContent || chunk.content || '',
                        model: chunk.model || request.model || this.config.defaultModel,
                        usage: chunk.usage || {
                            promptTokens: 0,
                            completionTokens: 0,
                            totalTokens: 0,
                        },
                        created: Date.now(),
                    };
                }
            };

            this.on('chat:chunk', chunkHandler);

            try {
                this.send(message);
            } catch (error) {
                this.off('chat:chunk', chunkHandler);
                reject(error);
            }
        });
    }

    /**
     * Create a new session
     */
    async createSession(userId?: string, roomId?: string): Promise<SessionInfo> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const message = MessageBuilder.createSession(userId, roomId);
        const response = await this.sendRequest<SessionInfo>(message);
        return response;
    }

    /**
     * Close a session
     */
    async closeSession(sessionId: string): Promise<void> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const message = MessageBuilder.closeSession(sessionId);
        await this.sendRequest<void>(message);
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<HealthCheckResponse> {
        if (!this.isConnected()) {
            throw new Error('Not connected to gateway');
        }

        const message = MessageBuilder.healthCheck();
        return this.sendRequest<HealthCheckResponse>(message);
    }

    /**
     * Send a raw message
     */
    private send<T>(message: WSMessage<T>): void {
        if (!this.ws) {
            throw new Error('WebSocket not initialized');
        }

        const data = JSON.stringify(message);
        debug('Sending: %s', data);
        this.ws.send(data);
    }

    /**
     * Send a request and wait for response
     */
    private sendRequest<T>(message: WSMessage): Promise<T> {
        return new Promise((resolve, reject) => {
            const requestId = message.requestId;

            const timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId);
                reject(new Error('Request timeout'));
            }, this.config.timeout);

            this.pendingRequests.set(requestId, {
                resolve: resolve as (value: unknown) => void,
                reject,
                timeout,
            });

            try {
                this.send(message);
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
    private handleMessage(data: string | Buffer): void {
        debug('Received: %s', data);

        const parsed = MessageParser.parse(data);
        if (!parsed) {
            debug('Failed to parse message');
            return;
        }

        // Handle pong responses
        if (parsed.type === 'pong') {
            return;
        }

        // Check if this is a response to a pending request
        const pending = this.pendingRequests.get(parsed.requestId);

        if (parsed.type === 'chat.completion.stream' && pending?.stream) {
            // Handle streaming chunk
            const chunk = parsed.payload as ChatCompletionChunk;
            this.emit('chat:chunk', chunk);

            if (chunk.finished) {
                clearTimeout(pending.timeout);
                this.pendingRequests.delete(parsed.requestId);

                const response: ChatCompletionResponse = {
                    id: chunk.id,
                    sessionId: chunk.sessionId,
                    content: pending.accumulatedContent || chunk.content || '',
                    model: chunk.model || this.config.defaultModel,
                    usage: chunk.usage || {
                        promptTokens: 0,
                        completionTokens: 0,
                        totalTokens: 0,
                    },
                    created: Date.now(),
                };

                pending.resolve(response);
                this.emit('chat:complete', response);
            }
            return;
        }

        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(parsed.requestId);

            if ('error' in parsed.payload && parsed.payload.error) {
                pending.reject(new Error(parsed.payload.error as string));
            } else {
                pending.resolve(parsed.payload);
            }
        }
    }

    /**
     * Handle WebSocket disconnect
     */
    private handleDisconnect(): void {
        this.stopPingInterval();

        const wasConnected = this.status === 'connected';
        this.setStatus('disconnected');
        this.ws = null;

        if (wasConnected) {
            this.emit('disconnected');
        }

        // Attempt reconnection if enabled
        if (this.config.reconnect.enabled && this.reconnectAttempts < this.config.reconnect.maxAttempts) {
            this.scheduleReconnect();
        }
    }

    /**
     * Schedule a reconnection attempt
     */
    private scheduleReconnect(): void {
        const delay = this.config.reconnect.delayMs *
            Math.pow(this.config.reconnect.backoffMultiplier ?? 2, this.reconnectAttempts);

        debug('Scheduling reconnect in %dms (attempt %d)', delay, this.reconnectAttempts + 1);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect().catch((error) => {
                debug('Reconnect failed: %o', error);
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
                const ping = MessageBuilder.ping();
                this.send(ping);
            }
        }, 30000); // Ping every 30 seconds
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
     * Set connection status and emit event
     */
    private setStatus(status: ConnectionStatus): void {
        if (this.status !== status) {
            this.status = status;
            this.emit('status:changed', status);
        }
    }
}
