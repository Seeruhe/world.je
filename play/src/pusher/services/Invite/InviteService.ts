import { v4 as uuidv4 } from "uuid";
import { randomBytes } from "crypto";
import {
    INVITE_ENABLED,
    INVITE_REWARD_POINTS,
    INVITE_CODE_LENGTH,
    POSTGRES_HOST,
} from "../../enums/EnvironmentVariable";
import { query, transaction } from "../../../../../back/src/Services/Database";

export interface InviteCode {
    id: string;
    code: string;
    creatorWalletId: string;
    maxUses: number;
    currentUses: number;
    isActive: boolean;
    expiresAt: Date | null;
    createdAt: Date;
}

export interface InviteRecord {
    id: string;
    inviteCodeId: string;
    inviterWalletId: string;
    inviteeWalletId: string;
    rewardClaimed: boolean;
    rewardPoints: number;
    createdAt: Date;
}

export interface InviteStats {
    totalInvites: number;
    successfulInvites: number;
    totalPointsEarned: number;
    codes: InviteCode[];
}

export class InviteService {
    /**
     * Generate a new invite code
     */
    async createInviteCode(
        creatorWalletId: string,
        maxUses: number = -1,
        expiresAt?: Date
    ): Promise<InviteCode | null> {
        if (!INVITE_ENABLED) {
            throw new Error("Invite system is not enabled");
        }

        if (!POSTGRES_HOST) {
            throw new Error("Database is not configured");
        }

        const code = this.generateCode(INVITE_CODE_LENGTH);

        try {
            const result = await query<InviteCode>(
                `INSERT INTO invite_codes (code, creator_wallet_id, max_uses, current_uses, is_active, expires_at, created_at)
                VALUES ($1, $2, $3, 0, true, $4, NOW())
                RETURNING *`,
                [code, creatorWalletId, maxUses, expiresAt || null]
            );

            return result.rows[0] || null;
        } catch (err) {
            console.error("Error creating invite code:", err);
            throw err;
        }
    }

    /**
     * Get invite codes created by a user
     */
    async getInviteCodesByCreator(creatorWalletId: string): Promise<InviteCode[]> {
        if (!POSTGRES_HOST) {
            return [];
        }

        try {
            const result = await query<InviteCode>(
                `SELECT * FROM invite_codes
                WHERE creator_wallet_id = $1
                ORDER BY created_at DESC`,
                [creatorWalletId]
            );

            return result.rows;
        } catch (err) {
            console.error("Error getting invite codes:", err);
            return [];
        }
    }

    /**
     * Get invite code by code string
     */
    async getInviteCodeByCode(code: string): Promise<InviteCode | null> {
        if (!POSTGRES_HOST) {
            return null;
        }

        try {
            const result = await query<InviteCode>(
                "SELECT * FROM invite_codes WHERE code = $1",
                [code]
            );

            return result.rows[0] || null;
        } catch (err) {
            console.error("Error getting invite code:", err);
            return null;
        }
    }

    /**
     * Use an invite code for a new user
     */
    async useInviteCode(
        code: string,
        inviteeWalletId: string
    ): Promise<{ success: boolean; record?: InviteRecord; error?: string }> {
        if (!INVITE_ENABLED) {
            return { success: false, error: "Invite system is not enabled" };
        }

        if (!POSTGRES_HOST) {
            return { success: false, error: "Database is not configured" };
        }

        try {
            return await transaction(async (client) => {
                // Get the invite code
                const codeResult = await client.query<InviteCode>(
                    "SELECT * FROM invite_codes WHERE code = $1 FOR UPDATE",
                    [code]
                );

                if (codeResult.rows.length === 0) {
                    return { success: false, error: "Invalid invite code" };
                }

                const inviteCode = codeResult.rows[0] as unknown as Record<string, unknown>;

                // Check if code is active
                if (!inviteCode.is_active) {
                    return { success: false, error: "Invite code is no longer active" };
                }

                // Check if code has expired
                const expiresAt = inviteCode.expires_at as Date | null;
                if (expiresAt && new Date(expiresAt) < new Date()) {
                    return { success: false, error: "Invite code has expired" };
                }

                // Check if code has reached max uses
                const maxUses = inviteCode.max_uses as number;
                const currentUses = inviteCode.current_uses as number;
                if (maxUses > 0 && currentUses >= maxUses) {
                    return { success: false, error: "Invite code has reached maximum uses" };
                }

                // Check if user has already been invited
                const existingRecord = await client.query(
                    "SELECT id FROM invite_records WHERE invitee_wallet_id = $1",
                    [inviteeWalletId]
                );

                if (existingRecord.rows.length > 0) {
                    return { success: false, error: "You have already been invited" };
                }

                // Create invite record
                const recordResult = await client.query<InviteRecord>(
                    `INSERT INTO invite_records (invite_code_id, inviter_wallet_id, invitee_wallet_id, reward_claimed, reward_points, created_at)
                    VALUES ($1, $2, $3, false, $4, NOW())
                    RETURNING *`,
                    [inviteCode.id, inviteCode.creator_wallet_id, inviteeWalletId, INVITE_REWARD_POINTS]
                );

                // Update invite code uses
                await client.query(
                    "UPDATE invite_codes SET current_uses = current_uses + 1 WHERE id = $1",
                    [inviteCode.id]
                );

                // Award points to inviter
                await client.query(
                    `UPDATE user_profiles
                    SET points = points + $1
                    WHERE wallet_id = $2`,
                    [INVITE_REWARD_POINTS, inviteCode.creator_wallet_id]
                );

                // Record points transaction
                await client.query(
                    `INSERT INTO points_transactions (wallet_id, amount, balance_after, transaction_type, reference_id, metadata, created_at)
                    SELECT $1, $2, points, 'invite_reward', $3, '{"type": "invite"}'::jsonb, NOW()
                    FROM user_profiles WHERE wallet_id = $1`,
                    [inviteCode.creator_wallet_id, INVITE_REWARD_POINTS, recordResult.rows[0].id]
                );

                // Check and award badges for inviter
                await client.query("SELECT check_and_award_badges($1)", [inviteCode.creator_wallet_id]);

                return { success: true, record: recordResult.rows[0] };
            });
        } catch (err) {
            console.error("Error using invite code:", err);
            return { success: false, error: "Failed to process invite code" };
        }
    }

    /**
     * Get invite statistics for a user
     */
    async getInviteStats(walletId: string): Promise<InviteStats> {
        const defaultStats: InviteStats = {
            totalInvites: 0,
            successfulInvites: 0,
            totalPointsEarned: 0,
            codes: [],
        };

        if (!POSTGRES_HOST) {
            return defaultStats;
        }

        try {
            // Get codes
            const codes = await this.getInviteCodesByCreator(walletId);

            // Get stats
            const statsResult = await query<{
                total_invites: string;
                successful_invites: string;
                total_points: string;
            }>(
                `SELECT
                    COUNT(*) as total_invites,
                    COUNT(*) FILTER (WHERE reward_claimed = true) as successful_invites,
                    COALESCE(SUM(reward_points), 0) as total_points
                FROM invite_records
                WHERE inviter_wallet_id = $1`,
                [walletId]
            );

            if (statsResult.rows.length > 0) {
                return {
                    totalInvites: parseInt(statsResult.rows[0].total_invites, 10),
                    successfulInvites: parseInt(statsResult.rows[0].successful_invites, 10),
                    totalPointsEarned: parseInt(statsResult.rows[0].total_points, 10),
                    codes,
                };
            }

            return { ...defaultStats, codes };
        } catch (err) {
            console.error("Error getting invite stats:", err);
            return defaultStats;
        }
    }

    /**
     * Deactivate an invite code
     */
    async deactivateInviteCode(codeId: string, creatorWalletId: string): Promise<boolean> {
        if (!POSTGRES_HOST) {
            return false;
        }

        try {
            const result = await query(
                `UPDATE invite_codes
                SET is_active = false
                WHERE id = $1 AND creator_wallet_id = $2`,
                [codeId, creatorWalletId]
            );

            return (result.rowCount ?? 0) > 0;
        } catch (err) {
            console.error("Error deactivating invite code:", err);
            return false;
        }
    }

    /**
     * Generate a random invite code
     */
    private generateCode(length: number): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing characters
        let code = "";
        const bytes = randomBytes(length);
        for (let i = 0; i < length; i++) {
            code += chars[bytes[i] % chars.length];
        }
        return code;
    }
}

export const inviteService = new InviteService();
