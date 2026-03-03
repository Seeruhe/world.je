/**
 * OpenClaw API Controller
 * Provides HTTP endpoints for OpenClaw integration
 */

import type { Express, Request, Response } from "express";
import {
    openClawGatewayService,
    openClawSessionManager,
    type ChatCompletionClientRequest,
} from "../Services/OpenClaw";

export class OpenClawController {
    constructor(private app: Express) {
        // Chat completion endpoint
        this.app.post("/api/openclaw/chat", this.handleChat.bind(this));

        // Health check endpoint
        this.app.get("/health/openclaw", this.handleHealth.bind(this));

        // Session management endpoints
        this.app.get("/api/openclaw/sessions/:sessionId", this.handleGetSession.bind(this));
        this.app.delete("/api/openclaw/sessions/:sessionId", this.handleCloseSession.bind(this));
        this.app.get("/api/openclaw/sessions/user/:userId", this.handleGetUserSessions.bind(this));
    }

    /**
     * Handle chat completion request
     */
    private async handleChat(req: Request, res: Response): Promise<void> {
        try {
            // Check if OpenClaw is enabled
            if (!openClawGatewayService.isEnabled()) {
                res.status(503).json({
                    error: "OpenClaw service is disabled",
                    code: "SERVICE_DISABLED",
                });
                return;
            }

            // Validate request
            const request = req.body as ChatCompletionClientRequest;
            if (!request.messages || !Array.isArray(request.messages)) {
                res.status(400).json({
                    error: "Missing or invalid 'messages' field",
                    code: "INVALID_REQUEST",
                });
                return;
            }

            // Ensure connection
            if (!openClawGatewayService.isConnected()) {
                try {
                    await openClawGatewayService.connect();
                } catch (connectError) {
                    console.error("Failed to connect to OpenClaw:", connectError);
                    res.status(503).json({
                        error: "Failed to connect to OpenClaw Gateway",
                        code: "CONNECTION_ERROR",
                    });
                    return;
                }
            }

            // Send request
            const response = await openClawGatewayService.sendChatCompletion(request);
            res.json(response);
        } catch (error) {
            console.error("OpenClaw chat error:", error);
            res.status(500).json({
                error: error instanceof Error ? error.message : "Internal server error",
                code: "INTERNAL_ERROR",
            });
        }
    }

    /**
     * Handle health check request
     */
    private async handleHealth(_req: Request, res: Response): Promise<void> {
        try {
            const health = await openClawGatewayService.healthCheck();
            const statusCode = health.status === "healthy" ? 200 : health.status === "disabled" ? 503 : 503;
            res.status(statusCode).json(health);
        } catch (error) {
            res.status(503).json({
                status: "unhealthy",
                connected: false,
                error: error instanceof Error ? error.message : "Health check failed",
            });
        }
    }

    /**
     * Get session info
     */
    private handleGetSession(req: Request, res: Response): void {
        const { sessionId } = req.params;
        const session = openClawSessionManager.getSession(sessionId);

        if (!session) {
            res.status(404).json({
                error: "Session not found",
                code: "NOT_FOUND",
            });
            return;
        }

        res.json(session);
    }

    /**
     * Close a session
     */
    private handleCloseSession(req: Request, res: Response): void {
        const { sessionId } = req.params;
        const closed = openClawSessionManager.closeSession(sessionId);

        if (!closed) {
            res.status(404).json({
                error: "Session not found",
                code: "NOT_FOUND",
            });
            return;
        }

        res.json({ success: true, message: "Session closed" });
    }

    /**
     * Get sessions for a user
     */
    private handleGetUserSessions(req: Request, res: Response): void {
        const { userId } = req.params;
        const sessions = openClawSessionManager.getUserSessions(userId);
        res.json(sessions);
    }
}
