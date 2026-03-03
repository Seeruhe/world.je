import { Pool, PoolClient, QueryResult } from "pg";
import * as Sentry from "@sentry/node";
import {
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DATABASE,
} from "../../Enum/EnvironmentVariable";

export interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
}

const defaultConfig: DatabaseConfig = {
    host: POSTGRES_HOST || "localhost",
    port: POSTGRES_PORT || 5432,
    user: POSTGRES_USER || "workadventure",
    password: POSTGRES_PASSWORD || "",
    database: POSTGRES_DATABASE || "workadventure",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};

let pool: Pool | null = null;
let healthCheckInterval: NodeJS.Timeout | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function createPool(config: Partial<DatabaseConfig> = {}): Pool | null {
    if (!POSTGRES_HOST) {
        console.warn("PostgreSQL is not configured. Set POSTGRES_HOST to enable database features.");
        return null;
    }

    const finalConfig = { ...defaultConfig, ...config };

    pool = new Pool({
        host: finalConfig.host,
        port: finalConfig.port,
        user: finalConfig.user,
        password: finalConfig.password,
        database: finalConfig.database,
        max: finalConfig.max,
        idleTimeoutMillis: finalConfig.idleTimeoutMillis,
        connectionTimeoutMillis: finalConfig.connectionTimeoutMillis,
    });

    pool.on("error", (err: Error) => {
        console.error("Unexpected PostgreSQL pool error:", err);
        Sentry.captureException(err);
    });

    pool.on("connect", () => {
        console.info("PostgreSQL client connected");
    });

    // Health check interval
    healthCheckInterval = setInterval(async () => {
        try {
            await query("SELECT 1");
        } catch (err) {
            console.error("PostgreSQL health check failed:", err);
            Sentry.captureException(err);
        }
    }, 60000);

    console.info(`PostgreSQL pool created: ${finalConfig.host}:${finalConfig.port}/${finalConfig.database}`);
    return pool;
}

/**
 * Get the current PostgreSQL pool
 */
export function getPool(): Pool | null {
    return pool;
}

/**
 * Execute a SQL query
 */
export async function query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = []
): Promise<QueryResult<T>> {
    if (!pool) {
        throw new Error("PostgreSQL pool is not initialized");
    }

    const start = Date.now();
    try {
        const result = await pool.query<T>(sql, params);
        const duration = Date.now() - start;

        if (duration > 1000) {
            console.warn(`Slow query (${duration}ms): ${sql.substring(0, 100)}...`);
        }

        return result;
    } catch (err) {
        console.error("PostgreSQL query error:", err);
        console.error("Query:", sql);
        console.error("Params:", params);
        Sentry.captureException(err);
        throw err;
    }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
    callback: (client: PoolClient) => Promise<T>
): Promise<T> {
    if (!pool) {
        throw new Error("PostgreSQL pool is not initialized");
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Close the PostgreSQL pool
 */
export async function closePool(): Promise<void> {
    if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
    }

    if (pool) {
        await pool.end();
        pool = null;
        console.info("PostgreSQL pool closed");
    }
}

/**
 * Check database health
 */
export async function healthCheck(): Promise<{ status: string; latency?: number; error?: string }> {
    if (!pool) {
        return { status: "not_configured" };
    }

    try {
        const start = Date.now();
        await query("SELECT 1");
        const latency = Date.now() - start;
        return { status: "healthy", latency };
    } catch (err) {
        return { status: "unhealthy", error: String(err) };
    }
}

// Type definitions for database entities
export interface UserWallet {
    id: string;
    wallet_address: string;
    nonce: string | null;
    chain_id: number;
    created_at: Date;
    last_login_at: Date | null;
    updated_at: Date;
}

export interface UserProfile {
    id: string;
    wallet_id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
    points: number;
    level: number;
    experience: number;
    bio: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface InviteCode {
    id: string;
    code: string;
    creator_wallet_id: string;
    max_uses: number;
    current_uses: number;
    is_active: boolean;
    expires_at: Date | null;
    created_at: Date;
}

export interface InviteRecord {
    id: string;
    invite_code_id: string;
    inviter_wallet_id: string;
    invitee_wallet_id: string;
    reward_claimed: boolean;
    reward_points: number;
    created_at: Date;
}

export interface AINPCConfig {
    id: string;
    npc_id: string;
    name: string;
    description: string | null;
    system_prompt: string | null;
    greeting: string | null;
    model: string;
    room_url: string | null;
    position_x: number | null;
    position_y: number | null;
    trigger_distance: number;
    texture: string | null;
    personality: string | null;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface AITriggerZone {
    id: string;
    zone_id: string;
    name: string;
    room_url: string;
    system_prompt: string | null;
    greeting: string | null;
    auto_open: boolean;
    model: string;
    is_active: boolean;
    created_at: Date;
}

export interface NFTBadge {
    id: string;
    badge_id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    contract_address: string | null;
    token_id: string | null;
    rarity: string;
    metadata: Record<string, unknown>;
    criteria: Record<string, unknown>;
    is_active: boolean;
    created_at: Date;
}

export interface UserBadge {
    id: string;
    wallet_id: string;
    badge_id: string;
    acquired_at: Date;
    is_displayed: boolean;
    metadata: Record<string, unknown>;
}

export interface AIConversation {
    id: string;
    wallet_id: string;
    npc_id: string | null;
    zone_id: string | null;
    session_id: string | null;
    role: string;
    content: string;
    created_at: Date;
}

export interface PointsTransaction {
    id: string;
    wallet_id: string;
    amount: number;
    balance_after: number;
    transaction_type: string;
    reference_id: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
}
