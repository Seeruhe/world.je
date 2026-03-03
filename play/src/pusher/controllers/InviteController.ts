import type { Application } from "express";
import { z } from "zod";
import Debug from "debug";
import { BaseHttpController } from "./BaseHttpController";
import { inviteService } from "../services/Invite";
import { walletAuthService } from "../services/Wallet";
import { INVITE_ENABLED } from "../enums/EnvironmentVariable";
import { validateQuery } from "../services/QueryValidator";

const debug = Debug("pusher:invite");

export class InviteController extends BaseHttpController {
    routes(): void {
        this.createCode();
        this.getMyCodes();
        this.getStats();
        this.useCode();
        this.deactivateCode();
    }

    /**
     * @openapi
     * /invite/create:
     *   post:
     *     description: Create a new invite code
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               token:
     *                 type: string
     *                 description: JWT authentication token
     *               maxUses:
     *                 type: number
     *                 description: Maximum number of uses (-1 for unlimited)
     *               expiresAt:
     *                 type: string
     *                 format: date-time
     *                 description: Expiration date
     *     responses:
     *       200:
     *         description: Invite code created successfully
     */
    private createCode(): void {
        this.app.post("/invite/create", async (req, res) => {
            debug(`InviteController => [${req.method}] ${req.originalUrl}`);

            if (!INVITE_ENABLED) {
                res.status(403).json({ error: "Invite system is not enabled" });
                return;
            }

            const bodySchema = z.object({
                token: z.string().min(1, "Token is required"),
                maxUses: z.number().int().optional().default(-1),
                expiresAt: z.string().datetime().optional(),
            });

            const body = bodySchema.safeParse(req.body);
            if (!body.success) {
                res.status(400).json({ error: "Invalid request body", details: body.error.errors });
                return;
            }

            try {
                const tokenPayload = walletAuthService.verifyWalletToken(body.data.token);
                if (!tokenPayload) {
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }

                const inviteCode = await inviteService.createInviteCode(
                    tokenPayload.identifier,
                    body.data.maxUses,
                    body.data.expiresAt ? new Date(body.data.expiresAt) : undefined
                );

                res.json({ success: true, code: inviteCode });
            } catch (err) {
                console.error("Error creating invite code:", err);
                res.status(500).json({ error: "Failed to create invite code" });
            }
        });
    }

    /**
     * @openapi
     * /invite/my-codes:
     *   get:
     *     description: Get invite codes created by the user
     *     parameters:
     *       - name: token
     *         in: query
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: List of invite codes
     */
    private getMyCodes(): void {
        this.app.get("/invite/my-codes", async (req, res) => {
            debug(`InviteController => [${req.method}] ${req.originalUrl}`);

            if (!INVITE_ENABLED) {
                res.status(403).json({ error: "Invite system is not enabled" });
                return;
            }

            const query = validateQuery(
                req,
                res,
                z.object({
                    token: z.string().min(1, "Token is required"),
                })
            );

            if (!query) {
                return;
            }

            try {
                const tokenPayload = walletAuthService.verifyWalletToken(query.token);
                if (!tokenPayload) {
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }

                const codes = await inviteService.getInviteCodesByCreator(tokenPayload.identifier);
                res.json({ codes });
            } catch (err) {
                console.error("Error getting invite codes:", err);
                res.status(500).json({ error: "Failed to get invite codes" });
            }
        });
    }

    /**
     * @openapi
     * /invite/stats:
     *   get:
     *     description: Get invite statistics for the user
     *     parameters:
     *       - name: token
     *         in: query
     *         required: true
     *         schema:
     *           type: string
     *     responses:
     *       200:
     *         description: Invite statistics
     */
    private getStats(): void {
        this.app.get("/invite/stats", async (req, res) => {
            debug(`InviteController => [${req.method}] ${req.originalUrl}`);

            if (!INVITE_ENABLED) {
                res.status(403).json({ error: "Invite system is not enabled" });
                return;
            }

            const query = validateQuery(
                req,
                res,
                z.object({
                    token: z.string().min(1, "Token is required"),
                })
            );

            if (!query) {
                return;
            }

            try {
                const tokenPayload = walletAuthService.verifyWalletToken(query.token);
                if (!tokenPayload) {
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }

                const stats = await inviteService.getInviteStats(tokenPayload.identifier);
                res.json(stats);
            } catch (err) {
                console.error("Error getting invite stats:", err);
                res.status(500).json({ error: "Failed to get invite statistics" });
            }
        });
    }

    /**
     * @openapi
     * /invite/use:
     *   post:
     *     description: Use an invite code for a new user
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               code:
     *                 type: string
     *                 description: The invite code to use
     *               token:
     *                 type: string
     *                 description: JWT authentication token
     *     responses:
     *       200:
     *         description: Invite code used successfully
     */
    private useCode(): void {
        this.app.post("/invite/use", async (req, res) => {
            debug(`InviteController => [${req.method}] ${req.originalUrl}`);

            if (!INVITE_ENABLED) {
                res.status(403).json({ error: "Invite system is not enabled" });
                return;
            }

            const bodySchema = z.object({
                code: z.string().min(1, "Invite code is required"),
                token: z.string().min(1, "Token is required"),
            });

            const body = bodySchema.safeParse(req.body);
            if (!body.success) {
                res.status(400).json({ error: "Invalid request body", details: body.error.errors });
                return;
            }

            try {
                const tokenPayload = walletAuthService.verifyWalletToken(body.data.token);
                if (!tokenPayload) {
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }

                const result = await inviteService.useInviteCode(
                    body.data.code,
                    tokenPayload.identifier
                );

                if (result.success) {
                    res.json({ success: true, record: result.record });
                } else {
                    res.status(400).json({ success: false, error: result.error });
                }
            } catch (err) {
                console.error("Error using invite code:", err);
                res.status(500).json({ error: "Failed to use invite code" });
            }
        });
    }

    /**
     * @openapi
     * /invite/deactivate:
     *   post:
     *     description: Deactivate an invite code
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               codeId:
     *                 type: string
     *                 description: The invite code ID to deactivate
     *               token:
     *                 type: string
     *                 description: JWT authentication token
     *     responses:
     *       200:
     *         description: Invite code deactivated successfully
     */
    private deactivateCode(): void {
        this.app.post("/invite/deactivate", async (req, res) => {
            debug(`InviteController => [${req.method}] ${req.originalUrl}`);

            if (!INVITE_ENABLED) {
                res.status(403).json({ error: "Invite system is not enabled" });
                return;
            }

            const bodySchema = z.object({
                codeId: z.string().uuid("Invalid code ID"),
                token: z.string().min(1, "Token is required"),
            });

            const body = bodySchema.safeParse(req.body);
            if (!body.success) {
                res.status(400).json({ error: "Invalid request body", details: body.error.errors });
                return;
            }

            try {
                const tokenPayload = walletAuthService.verifyWalletToken(body.data.token);
                if (!tokenPayload) {
                    res.status(401).json({ error: "Invalid or expired token" });
                    return;
                }

                const success = await inviteService.deactivateInviteCode(
                    body.data.codeId,
                    tokenPayload.identifier
                );

                if (success) {
                    res.json({ success: true });
                } else {
                    res.status(404).json({ success: false, error: "Invite code not found or not owned by you" });
                }
            } catch (err) {
                console.error("Error deactivating invite code:", err);
                res.status(500).json({ error: "Failed to deactivate invite code" });
            }
        });
    }
}
