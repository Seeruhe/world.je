import type { Application } from "express";
import { z } from "zod";
import Debug from "debug";
import { BaseHttpController } from "./BaseHttpController";
import { walletAuthService } from "../services/Wallet";
import { WALLET_AUTH_ENABLED } from "../enums/EnvironmentVariable";
import { validateQuery } from "../services/QueryValidator";

const debug = Debug("pusher:wallet");

export class WalletController extends BaseHttpController {
    routes(): void {
        this.getNonce();
        this.verifySignature();
        this.getMe();
    }

    /**
     * @openapi
     * /wallet/nonce:
     *   post:
     *     description: Generate a nonce for wallet signature verification
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               walletAddress:
     *                 type: string
     *                 description: Ethereum wallet address
     *                 example: "0x1234567890abcdef1234567890abcdef12345678"
     *     responses:
     *       200:
     *         description: Nonce generated successfully
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 nonce:
     *                   type: string
     *                   description: Nonce to sign
     *                 message:
     *                   type: string
     *                   description: Full message to sign
     *                 expiresAt:
     *                   type: number
     *                   description: Unix timestamp when nonce expires
     *       400:
     *         description: Invalid wallet address
     *       403:
     *         description: Wallet authentication is not enabled
     */
    private getNonce(): void {
        this.app.post("/wallet/nonce", async (req, res) => {
            debug(`WalletController => [${req.method}] ${req.originalUrl}`);

            if (!WALLET_AUTH_ENABLED) {
                res.status(403).json({ error: "Wallet authentication is not enabled" });
                return;
            }

            const bodySchema = z.object({
                walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
            });

            const body = bodySchema.safeParse(req.body);
            if (!body.success) {
                res.status(400).json({ error: "Invalid wallet address", details: body.error.errors });
                return;
            }

            try {
                const response = await walletAuthService.generateNonce(body.data.walletAddress);
                res.json(response);
            } catch (err) {
                console.error("Error generating nonce:", err);
                res.status(500).json({ error: "Failed to generate nonce" });
            }
        });
    }

    /**
     * @openapi
     * /wallet/verify:
     *   post:
     *     description: Verify wallet signature and authenticate user
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               walletAddress:
     *                 type: string
     *                 description: Ethereum wallet address
     *               signature:
     *                 type: string
     *                 description: Signature of the nonce message
     *               nonce:
     *                 type: string
     *                 description: The nonce that was signed
     *               chainId:
     *                 type: number
     *                 description: Chain ID the wallet is connected to
     *     responses:
     *       200:
     *         description: Authentication successful
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 success:
     *                   type: boolean
     *                 authToken:
     *                   type: string
     *                   description: JWT authentication token
     *                 userUuid:
     *                   type: string
     *                   description: User UUID
     *                 walletAddress:
     *                   type: string
     *                   description: Wallet address
     *                 isNewUser:
     *                   type: boolean
     *                   description: Whether this is a new user
     *       401:
     *         description: Invalid signature or nonce
     */
    private verifySignature(): void {
        this.app.post("/wallet/verify", async (req, res) => {
            debug(`WalletController => [${req.method}] ${req.originalUrl}`);

            if (!WALLET_AUTH_ENABLED) {
                res.status(403).json({ error: "Wallet authentication is not enabled" });
                return;
            }

            const bodySchema = z.object({
                walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
                signature: z.string().min(1, "Signature is required"),
                nonce: z.string().min(1, "Nonce is required"),
                chainId: z.number().optional(),
            });

            const body = bodySchema.safeParse(req.body);
            if (!body.success) {
                res.status(400).json({ error: "Invalid request body", details: body.error.errors });
                return;
            }

            try {
                const response = await walletAuthService.verifySignature({
                    walletAddress: body.data.walletAddress,
                    signature: body.data.signature,
                    nonce: body.data.nonce,
                    chainId: body.data.chainId,
                });

                if (response.success) {
                    res.json(response);
                } else {
                    res.status(401).json(response);
                }
            } catch (err) {
                console.error("Error verifying signature:", err);
                res.status(500).json({ error: "Failed to verify signature" });
            }
        });
    }

    /**
     * @openapi
     * /wallet/me:
     *   get:
     *     description: Get current wallet user information
     *     parameters:
     *       - name: token
     *         in: query
     *         required: true
     *         schema:
     *           type: string
     *         description: JWT authentication token
     *     responses:
     *       200:
     *         description: User information
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 walletAddress:
     *                   type: string
     *                 userUuid:
     *                   type: string
     *                 username:
     *                   type: string
     *                 points:
     *                   type: number
     *                 level:
     *                   type: number
     *                 badges:
     *                   type: array
     *                   items:
     *                     type: string
     *       401:
     *         description: Invalid or expired token
     */
    private getMe(): void {
        this.app.get("/wallet/me", async (req, res) => {
            debug(`WalletController => [${req.method}] ${req.originalUrl}`);

            if (!WALLET_AUTH_ENABLED) {
                res.status(403).json({ error: "Wallet authentication is not enabled" });
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

                const user = await walletAuthService.getUserById(tokenPayload.identifier);
                if (!user) {
                    res.status(404).json({ error: "User not found" });
                    return;
                }

                res.json(user);
            } catch (err) {
                console.error("Error getting user info:", err);
                res.status(500).json({ error: "Failed to get user info" });
            }
        });
    }
}
