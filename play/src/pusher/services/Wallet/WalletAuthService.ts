import Jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import {
    SECRET_KEY,
    WALLET_AUTH_ENABLED,
    WALLET_CHAIN_ID,
    POSTGRES_HOST,
} from "../../enums/EnvironmentVariable";
import {
    query,
    transaction,
    type UserWallet,
    type UserProfile,
} from "../../../../../back/src/Services/Database";

export interface WalletNonceResponse {
    nonce: string;
    message: string;
    expiresAt: number;
}

export interface WalletVerifyRequest {
    walletAddress: string;
    signature: string;
    nonce: string;
    chainId?: number;
}

export interface WalletVerifyResponse {
    success: boolean;
    authToken?: string;
    userUuid?: string;
    walletAddress?: string;
    isNewUser?: boolean;
    error?: string;
}

export interface WalletUser {
    walletAddress: string;
    userUuid: string;
    username?: string;
    points: number;
    level: number;
    badges: string[];
}

export const WalletAuthTokenData = Jwt.sign.bind(null, {
    wallet: true,
});

export interface WalletTokenPayload {
    identifier: string;
    walletAddress: string;
    wallet: true;
    iat: number;
    exp: number;
}

// Store nonces temporarily (in production, use Redis)
const nonceStore = new Map<string, { nonce: string; expiresAt: number }>();

// Clean up expired nonces every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of nonceStore.entries()) {
        if (value.expiresAt < now) {
            nonceStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

export class WalletAuthService {
    /**
     * Generate a nonce for wallet signature
     */
    async generateNonce(walletAddress: string): Promise<WalletNonceResponse> {
        if (!WALLET_AUTH_ENABLED) {
            throw new Error("Wallet authentication is not enabled");
        }

        const nonce = this.createNonce();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store nonce
        nonceStore.set(walletAddress.toLowerCase(), { nonce, expiresAt });

        // Create the message to be signed
        const message = this.createSignMessage(walletAddress, nonce);

        return {
            nonce,
            message,
            expiresAt,
        };
    }

    /**
     * Verify wallet signature and authenticate user
     */
    async verifySignature(request: WalletVerifyRequest): Promise<WalletVerifyResponse> {
        if (!WALLET_AUTH_ENABLED) {
            return { success: false, error: "Wallet authentication is not enabled" };
        }

        if (!POSTGRES_HOST) {
            return { success: false, error: "Database is not configured" };
        }

        try {
            // Normalize wallet address
            const walletAddress = request.walletAddress.toLowerCase();

            // Verify nonce
            const storedNonce = nonceStore.get(walletAddress);
            if (!storedNonce) {
                return { success: false, error: "No nonce found for this wallet address" };
            }

            if (storedNonce.expiresAt < Date.now()) {
                nonceStore.delete(walletAddress);
                return { success: false, error: "Nonce has expired" };
            }

            if (storedNonce.nonce !== request.nonce) {
                return { success: false, error: "Invalid nonce" };
            }

            // Delete used nonce
            nonceStore.delete(walletAddress);

            // Verify the signature
            const isValid = await this.verifyEthSignature(
                walletAddress,
                request.signature,
                this.createSignMessage(walletAddress, request.nonce)
            );

            if (!isValid) {
                return { success: false, error: "Invalid signature" };
            }

            // Check chain ID if provided
            if (request.chainId && request.chainId !== WALLET_CHAIN_ID) {
                console.warn(`Warning: Chain ID mismatch. Expected ${WALLET_CHAIN_ID}, got ${request.chainId}`);
            }

            // Find or create user in database
            const { user, isNewUser } = await this.findOrCreateUser(walletAddress);

            // Create JWT token
            const authToken = this.createWalletToken(user);

            return {
                success: true,
                authToken,
                userUuid: user.id,
                walletAddress: user.wallet_address,
                isNewUser,
            };
        } catch (err) {
            console.error("Error verifying wallet signature:", err);
            return { success: false, error: "Internal server error" };
        }
    }

    /**
     * Get user by wallet address
     */
    async getUserByWallet(walletAddress: string): Promise<WalletUser | null> {
        if (!POSTGRES_HOST) {
            return null;
        }

        try {
            const result = await query<{
                id: string;
                wallet_address: string;
                username: string | null;
                points: number;
                level: number;
            }>(
                `SELECT
                    w.id,
                    w.wallet_address,
                    p.username,
                    p.points,
                    p.level
                FROM user_wallets w
                LEFT JOIN user_profiles p ON w.id = p.wallet_id
                WHERE w.wallet_address = $1`,
                [walletAddress.toLowerCase()]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];

            // Get user badges
            const badgesResult = await query<{ badge_id: string }>(
                `SELECT nb.badge_id
                FROM user_badges ub
                JOIN nft_badges nb ON ub.badge_id = nb.id
                WHERE ub.wallet_id = $1`,
                [row.id]
            );

            return {
                walletAddress: row.wallet_address,
                userUuid: row.id,
                username: row.username || undefined,
                points: row.points,
                level: row.level,
                badges: badgesResult.rows.map((r) => r.badge_id),
            };
        } catch (err) {
            console.error("Error getting user by wallet:", err);
            return null;
        }
    }

    /**
     * Get user by ID
     */
    async getUserById(userUuid: string): Promise<WalletUser | null> {
        if (!POSTGRES_HOST) {
            return null;
        }

        try {
            const result = await query<{
                id: string;
                wallet_address: string;
                username: string | null;
                points: number;
                level: number;
            }>(
                `SELECT
                    w.id,
                    w.wallet_address,
                    p.username,
                    p.points,
                    p.level
                FROM user_wallets w
                LEFT JOIN user_profiles p ON w.id = p.wallet_id
                WHERE w.id = $1`,
                [userUuid]
            );

            if (result.rows.length === 0) {
                return null;
            }

            const row = result.rows[0];

            // Get user badges
            const badgesResult = await query<{ badge_id: string }>(
                `SELECT nb.badge_id
                FROM user_badges ub
                JOIN nft_badges nb ON ub.badge_id = nb.id
                WHERE ub.wallet_id = $1`,
                [row.id]
            );

            return {
                walletAddress: row.wallet_address,
                userUuid: row.id,
                username: row.username || undefined,
                points: row.points,
                level: row.level,
                badges: badgesResult.rows.map((r) => r.badge_id),
            };
        } catch (err) {
            console.error("Error getting user by ID:", err);
            return null;
        }
    }

    /**
     * Verify JWT token for wallet user
     */
    verifyWalletToken(token: string): WalletTokenPayload | null {
        try {
            const decoded = Jwt.verify(token, SECRET_KEY) as WalletTokenPayload;
            if (!decoded.wallet || !decoded.walletAddress) {
                return null;
            }
            return decoded;
        } catch {
            return null;
        }
    }

    /**
     * Create a new nonce
     */
    private createNonce(): string {
        return `Sign this message to authenticate with WorkAdventure.\n\nNonce: ${randomBytes(32).toString("hex")}\n\nTimestamp: ${Date.now()}`;
    }

    /**
     * Create the message to be signed
     */
    private createSignMessage(walletAddress: string, nonce: string): string {
        return nonce;
    }

    /**
     * Verify Ethereum signature
     * Note: In production, use a proper library like ethers.js or viem
     */
    private async verifyEthSignature(
        walletAddress: string,
        signature: string,
        message: string
    ): Promise<boolean> {
        try {
            // Dynamic import to avoid issues if ethers is not installed
            const { verifyMessage } = await import("ethers");
            const recoveredAddress = verifyMessage(message, signature);
            return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
        } catch (err) {
            console.error("Error verifying signature:", err);
            // For development/testing, allow bypassing signature verification
            // In production, this should always verify the signature
            if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
                console.warn("Warning: Signature verification bypassed in development mode");
                return true;
            }
            return false;
        }
    }

    /**
     * Find or create user in database
     */
    private async findOrCreateUser(walletAddress: string): Promise<{ user: UserWallet; isNewUser: boolean }> {
        return await transaction(async (client) => {
            // Try to find existing user
            const existingResult = await client.query<UserWallet>(
                "SELECT * FROM user_wallets WHERE wallet_address = $1",
                [walletAddress]
            );

            if (existingResult.rows.length > 0) {
                // Update last login
                await client.query(
                    "UPDATE user_wallets SET last_login_at = NOW() WHERE id = $1",
                    [existingResult.rows[0].id]
                );
                return { user: existingResult.rows[0], isNewUser: false };
            }

            // Create new user
            const newWalletResult = await client.query<UserWallet>(
                `INSERT INTO user_wallets (wallet_address, nonce, chain_id, created_at, last_login_at)
                VALUES ($1, NULL, $2, NOW(), NOW())
                RETURNING *`,
                [walletAddress, WALLET_CHAIN_ID]
            );

            const newUser = newWalletResult.rows[0];

            // Create user profile
            await client.query(
                `INSERT INTO user_profiles (wallet_id, username, points, level, created_at)
                VALUES ($1, NULL, 0, 1, NOW())`,
                [newUser.id]
            );

            // Check if user qualifies for early adopter badge
            const userCountResult = await client.query<{ count: string }>(
                "SELECT COUNT(*) FROM user_wallets"
            );
            const userCount = parseInt(userCountResult.rows[0].count, 10);

            if (userCount <= 1000) {
                // Award early adopter badge
                await client.query(
                    `INSERT INTO user_badges (wallet_id, badge_id)
                    SELECT $1, id FROM nft_badges WHERE badge_id = 'early_adopter'
                    ON CONFLICT DO NOTHING`,
                    [newUser.id]
                );
            }

            return { user: newUser, isNewUser: true };
        });
    }

    /**
     * Create JWT token for wallet user
     */
    private createWalletToken(user: UserWallet): string {
        return Jwt.sign(
            {
                identifier: user.id,
                walletAddress: user.wallet_address,
                wallet: true,
            },
            SECRET_KEY,
            { expiresIn: "30d" }
        );
    }
}

export const walletAuthService = new WalletAuthService();
