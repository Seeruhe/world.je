/**
 * OpenClaw session manager
 * Manages AI chat sessions for users
 */

import { v4 as uuidv4 } from "uuid";
import type { SessionInfo } from "./types";

/**
 * Session storage
 */
interface SessionData extends SessionInfo {
    messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }>;
}

export class OpenClawSessionManager {
    private sessions: Map<string, SessionData> = new Map();
    private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
    private roomSessions: Map<string, Set<string>> = new Map(); // roomId -> sessionIds
    private cleanupInterval: NodeJS.Timeout | null = null;
    private readonly sessionTimeout = 30 * 60 * 1000; // 30 minutes

    constructor() {
        this.startCleanupInterval();
    }

    /**
     * Create a new session
     */
    createSession(userId?: string, roomId?: string): SessionInfo {
        const sessionId = uuidv4();
        const now = Date.now();

        const session: SessionData = {
            sessionId,
            userId,
            roomId,
            createdAt: now,
            lastActivityAt: now,
            messageCount: 0,
            messages: [],
        };

        this.sessions.set(sessionId, session);

        // Track user sessions
        if (userId) {
            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, new Set());
            }
            this.userSessions.get(userId)!.add(sessionId);
        }

        // Track room sessions
        if (roomId) {
            if (!this.roomSessions.has(roomId)) {
                this.roomSessions.set(roomId, new Set());
            }
            this.roomSessions.get(roomId)!.add(sessionId);
        }

        return {
            sessionId,
            userId,
            roomId,
            createdAt: now,
            lastActivityAt: now,
            messageCount: 0,
        };
    }

    /**
     * Get session info
     */
    getSession(sessionId: string): SessionInfo | undefined {
        const session = this.sessions.get(sessionId);
        if (!session) return undefined;

        return {
            sessionId: session.sessionId,
            userId: session.userId,
            roomId: session.roomId,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            messageCount: session.messageCount,
        };
    }

    /**
     * Get session messages
     */
    getSessionMessages(sessionId: string): Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> | undefined {
        const session = this.sessions.get(sessionId);
        return session?.messages;
    }

    /**
     * Add message to session
     */
    addMessage(
        sessionId: string,
        role: "system" | "user" | "assistant",
        content: string
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) return;

        session.messages.push({ role, content });
        session.lastActivityAt = Date.now();
        session.messageCount++;
    }

    /**
     * Update session activity
     */
    updateActivity(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivityAt = Date.now();
        }
    }

    /**
     * Close a session
     */
    closeSession(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        // Remove from user sessions
        if (session.userId) {
            this.userSessions.get(session.userId)?.delete(sessionId);
        }

        // Remove from room sessions
        if (session.roomId) {
            this.roomSessions.get(session.roomId)?.delete(sessionId);
        }

        return this.sessions.delete(sessionId);
    }

    /**
     * Get sessions for a user
     */
    getUserSessions(userId: string): SessionInfo[] {
        const sessionIds = this.userSessions.get(userId);
        if (!sessionIds) return [];

        return Array.from(sessionIds)
            .map((id) => this.getSession(id))
            .filter((s): s is SessionInfo => s !== undefined);
    }

    /**
     * Get sessions for a room
     */
    getRoomSessions(roomId: string): SessionInfo[] {
        const sessionIds = this.roomSessions.get(roomId);
        if (!sessionIds) return [];

        return Array.from(sessionIds)
            .map((id) => this.getSession(id))
            .filter((s): s is SessionInfo => s !== undefined);
    }

    /**
     * Start cleanup interval
     */
    private startCleanupInterval(): void {
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60 * 1000); // Check every minute
    }

    /**
     * Cleanup expired sessions
     */
    private cleanupExpiredSessions(): void {
        const now = Date.now();
        const expiredSessionIds: string[] = [];

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivityAt > this.sessionTimeout) {
                expiredSessionIds.push(sessionId);
            }
        }

        for (const sessionId of expiredSessionIds) {
            this.closeSession(sessionId);
        }

        if (expiredSessionIds.length > 0) {
            console.log(`Cleaned up ${expiredSessionIds.length} expired OpenClaw sessions`);
        }
    }

    /**
     * Destroy the session manager
     */
    destroy(): void {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.sessions.clear();
        this.userSessions.clear();
        this.roomSessions.clear();
    }
}

// Singleton instance
export const openClawSessionManager = new OpenClawSessionManager();
