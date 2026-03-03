/**
 * Message builder for OpenClaw Gateway protocol
 */

import type {
    WSMessage,
    WSMessageType,
    ChatCompletionRequest,
    SessionInfo,
} from './types';

/**
 * Generates a unique request ID
 */
export function generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generates a unique session ID
 */
export function generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Builds WebSocket messages for the OpenClaw Gateway
 */
export class MessageBuilder {
    /**
     * Create a chat completion message
     */
    static chatCompletion(request: ChatCompletionRequest): WSMessage<ChatCompletionRequest> {
        return {
            type: 'chat.completion',
            requestId: generateRequestId(),
            payload: request,
            timestamp: Date.now(),
        };
    }

    /**
     * Create a streaming chat completion message
     */
    static chatCompletionStream(request: ChatCompletionRequest): WSMessage<ChatCompletionRequest> {
        return {
            type: 'chat.completion.stream',
            requestId: generateRequestId(),
            payload: { ...request, stream: true },
            timestamp: Date.now(),
        };
    }

    /**
     * Create a session creation message
     */
    static createSession(userId?: string, roomId?: string): WSMessage<{ userId?: string; roomId?: string }> {
        return {
            type: 'session.create',
            requestId: generateRequestId(),
            payload: { userId, roomId },
            timestamp: Date.now(),
        };
    }

    /**
     * Create a session close message
     */
    static closeSession(sessionId: string): WSMessage<{ sessionId: string }> {
        return {
            type: 'session.close',
            requestId: generateRequestId(),
            payload: { sessionId },
            timestamp: Date.now(),
        };
    }

    /**
     * Create a session list message
     */
    static listSessions(userId?: string): WSMessage<{ userId?: string }> {
        return {
            type: 'session.list',
            requestId: generateRequestId(),
            payload: { userId },
            timestamp: Date.now(),
        };
    }

    /**
     * Create a health check message
     */
    static healthCheck(): WSMessage<Record<string, never>> {
        return {
            type: 'health',
            requestId: generateRequestId(),
            payload: {},
            timestamp: Date.now(),
        };
    }

    /**
     * Create a ping message
     */
    static ping(): WSMessage<Record<string, never>> {
        return {
            type: 'ping',
            requestId: generateRequestId(),
            payload: {},
            timestamp: Date.now(),
        };
    }
}

/**
 * Parses incoming WebSocket messages
 */
export class MessageParser {
    /**
     * Parse a raw WebSocket message
     */
    static parse<T = unknown>(data: string | Buffer): WSMessage<T> | null {
        try {
            const str = typeof data === 'string' ? data : data.toString('utf-8');
            return JSON.parse(str) as WSMessage<T>;
        } catch {
            console.error('Failed to parse WebSocket message:', data);
            return null;
        }
    }

    /**
     * Parse a response message
     */
    static parseResponse<T = unknown>(data: string | Buffer): WSMessage<T> | null {
        return this.parse<T>(data);
    }

    /**
     * Check if a message is a response to a specific request
     */
    static isResponseTo<T>(message: WSMessage<T>, requestId: string): boolean {
        return message.requestId === requestId;
    }
}
