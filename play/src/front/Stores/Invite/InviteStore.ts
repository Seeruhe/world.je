import { writable, derived, get } from "svelte/store";
import { PUSHER_URL, INVITE_ENABLED, INVITE_REWARD_POINTS } from "../../Enum/EnvironmentVariable";
import { walletStore } from "../Wallet";

export interface InviteCode {
    id: string;
    code: string;
    creatorWalletId: string;
    maxUses: number;
    currentUses: number;
    isActive: boolean;
    expiresAt: string | null;
    createdAt: string;
}

export interface InviteStats {
    totalInvites: number;
    successfulInvites: number;
    totalPointsEarned: number;
    codes: InviteCode[];
}

interface InviteState {
    isLoading: boolean;
    error: string | null;
    stats: InviteStats | null;
    lastCreatedCode: InviteCode | null;
}

const initialState: InviteState = {
    isLoading: false,
    error: null,
    stats: null,
    lastCreatedCode: null,
};

function createInviteStore() {
    const { subscribe, set, update } = writable<InviteState>(initialState);

    return {
        subscribe,
        setLoading: (loading: boolean) =>
            update((state) => ({ ...state, isLoading: loading, error: null })),
        setError: (error: string) =>
            update((state) => ({ ...state, error, isLoading: false })),
        setStats: (stats: InviteStats) =>
            update((state) => ({ ...state, stats, isLoading: false })),
        setCreatedCode: (code: InviteCode) =>
            update((state) => ({ ...state, lastCreatedCode: code, isLoading: false })),
        reset: () => set(initialState),
    };
}

export const inviteStore = createInviteStore();

// Derived stores
export const inviteCodes = derived(inviteStore, ($invite) => $invite.stats?.codes || []);
export const inviteStats = derived(inviteStore, ($invite) => $invite.stats);
export const isInviteLoading = derived(inviteStore, ($invite) => $invite.isLoading);
export const inviteError = derived(inviteStore, ($invite) => $invite.error);

// API functions
async function getAuthToken(): Promise<string | null> {
    const walletState = get(walletStore);
    return walletState.authToken;
}

export async function createInviteCode(maxUses: number = -1, expiresAt?: Date): Promise<InviteCode | null> {
    if (!INVITE_ENABLED) {
        inviteStore.setError("Invite system is not enabled");
        return null;
    }

    const token = await getAuthToken();
    if (!token) {
        inviteStore.setError("Please connect your wallet first");
        return null;
    }

    inviteStore.setLoading(true);

    try {
        const response = await fetch(`${PUSHER_URL}/invite/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                maxUses,
                expiresAt: expiresAt?.toISOString(),
            }),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to create invite code");
        }

        const data = await response.json();
        inviteStore.setCreatedCode(data.code);

        // Refresh stats
        await fetchInviteStats();

        return data.code;
    } catch (err) {
        console.error("Failed to create invite code:", err);
        inviteStore.setError(err instanceof Error ? err.message : "Failed to create invite code");
        return null;
    }
}

export async function fetchInviteStats(): Promise<InviteStats | null> {
    if (!INVITE_ENABLED) {
        return null;
    }

    const token = await getAuthToken();
    if (!token) {
        return null;
    }

    inviteStore.setLoading(true);

    try {
        const response = await fetch(`${PUSHER_URL}/invite/stats?token=${token}`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Failed to fetch invite stats");
        }

        const stats = await response.json();
        inviteStore.setStats(stats);
        return stats;
    } catch (err) {
        console.error("Failed to fetch invite stats:", err);
        inviteStore.setError(err instanceof Error ? err.message : "Failed to fetch invite stats");
        return null;
    }
}

export async function useInviteCode(code: string): Promise<boolean> {
    if (!INVITE_ENABLED) {
        inviteStore.setError("Invite system is not enabled");
        return false;
    }

    const token = await getAuthToken();
    if (!token) {
        inviteStore.setError("Please connect your wallet first");
        return false;
    }

    inviteStore.setLoading(true);

    try {
        const response = await fetch(`${PUSHER_URL}/invite/use`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, token }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to use invite code");
        }

        inviteStore.setLoading(false);
        return true;
    } catch (err) {
        console.error("Failed to use invite code:", err);
        inviteStore.setError(err instanceof Error ? err.message : "Failed to use invite code");
        return false;
    }
}

export async function deactivateInviteCode(codeId: string): Promise<boolean> {
    if (!INVITE_ENABLED) {
        inviteStore.setError("Invite system is not enabled");
        return false;
    }

    const token = await getAuthToken();
    if (!token) {
        inviteStore.setError("Please connect your wallet first");
        return false;
    }

    inviteStore.setLoading(true);

    try {
        const response = await fetch(`${PUSHER_URL}/invite/deactivate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codeId, token }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to deactivate invite code");
        }

        // Refresh stats
        await fetchInviteStats();
        return true;
    } catch (err) {
        console.error("Failed to deactivate invite code:", err);
        inviteStore.setError(err instanceof Error ? err.message : "Failed to deactivate invite code");
        return false;
    }
}

export function getInviteUrl(code: string): string {
    const baseUrl = window.location.origin;
    return `${baseUrl}?invite=${code}`;
}

export function getRewardPoints(): number {
    return INVITE_REWARD_POINTS;
}
