import { writable, derived, get } from "svelte/store";
import { PUSHER_URL } from "../../Enum/EnvironmentVariable";
import { walletStore } from "../Wallet";

export interface NFTBadge {
    id: string;
    badgeId: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    contractAddress: string | null;
    tokenId: string | null;
    rarity: "common" | "rare" | "epic" | "legendary";
    metadata: Record<string, unknown>;
    criteria: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
}

export interface UserBadge {
    id: string;
    walletId: string;
    badgeId: string;
    badge?: NFTBadge;
    acquiredAt: string;
    isDisplayed: boolean;
    metadata: Record<string, unknown>;
}

interface BadgeState {
    isLoading: boolean;
    error: string | null;
    userBadges: UserBadge[];
    availableBadges: NFTBadge[];
}

const initialState: BadgeState = {
    isLoading: false,
    error: null,
    userBadges: [],
    availableBadges: [],
};

function createBadgeStore() {
    const { subscribe, set, update } = writable<BadgeState>(initialState);

    return {
        subscribe,
        setLoading: (loading: boolean) =>
            update((state) => ({ ...state, isLoading: loading, error: null })),
        setError: (error: string) =>
            update((state) => ({ ...state, error, isLoading: false })),
        setUserBadges: (badges: UserBadge[]) =>
            update((state) => ({ ...state, userBadges: badges, isLoading: false })),
        setAvailableBadges: (badges: NFTBadge[]) =>
            update((state) => ({ ...state, availableBadges: badges, isLoading: false })),
        reset: () => set(initialState),
    };
}

export const badgeStore = createBadgeStore();

// Derived stores
export const userBadges = derived(badgeStore, ($badge) => $badge.userBadges);
export const availableBadges = derived(badgeStore, ($badge) => $badge.availableBadges);
export const isBadgeLoading = derived(badgeStore, ($badge) => $badge.isLoading);
export const badgeError = derived(badgeStore, ($badge) => $badge.error);

// Group badges by rarity
export const badgesByRarity = derived(userBadges, ($badges) => {
    const grouped: Record<string, UserBadge[]> = {
        legendary: [],
        epic: [],
        rare: [],
        common: [],
    };

    for (const badge of $badges) {
        const rarity = badge.badge?.rarity || "common";
        if (grouped[rarity]) {
            grouped[rarity].push(badge);
        }
    }

    return grouped;
});

// Get rarity color
export function getRarityColor(rarity: string): string {
    switch (rarity) {
        case "legendary":
            return "#f59e0b"; // amber
        case "epic":
            return "#8b5cf6"; // purple
        case "rare":
            return "#3b82f6"; // blue
        default:
            return "#6b7280"; // gray
    }
}

// Get rarity background gradient
export function getRarityGradient(rarity: string): string {
    switch (rarity) {
        case "legendary":
            return "linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)";
        case "epic":
            return "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #8b5cf6 100%)";
        case "rare":
            return "linear-gradient(135deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)";
        default:
            return "linear-gradient(135deg, #6b7280 0%, #9ca3af 50%, #6b7280 100%)";
    }
}

// Default badge images based on type
export function getDefaultBadgeImage(badgeId: string): string {
    // Return emoji based on badge type
    const badgeEmojis: Record<string, string> = {
        early_adopter: "🌟",
        first_invite: "🎁",
        super_inviter: "🏆",
        mega_inviter: "👑",
        ai_explorer: "🤖",
        ai_master: "🧠",
        verified_user: "✅",
    };

    return badgeEmojis[badgeId] || "🏅";
}

// Fetch user badges from wallet user info
export async function fetchUserBadges(): Promise<UserBadge[]> {
    const walletState = get(walletStore);

    if (!walletState.authToken) {
        return [];
    }

    badgeStore.setLoading(true);

    try {
        const userInfo = await fetch(
            `${PUSHER_URL}/wallet/me?token=${walletState.authToken}`
        ).then((r) => r.json());

        if (userInfo && userInfo.badges) {
            // Fetch badge details for each badge ID
            const badgeDetails = await Promise.all(
                userInfo.badges.map((badgeId: string) => fetchBadgeDetails(badgeId))
            );

            const userBadges: UserBadge[] = userInfo.badges.map(
                (badgeId: string, index: number) => ({
                    id: `${walletState.userUuid}-${badgeId}`,
                    walletId: walletState.userUuid || "",
                    badgeId,
                    badge: badgeDetails[index],
                    acquiredAt: new Date().toISOString(),
                    isDisplayed: false,
                    metadata: {},
                })
            );

            badgeStore.setUserBadges(userBadges);
            return userBadges;
        }

        badgeStore.setUserBadges([]);
        return [];
    } catch (err) {
        console.error("Failed to fetch user badges:", err);
        badgeStore.setError(err instanceof Error ? err.message : "Failed to fetch badges");
        return [];
    }
}

async function fetchBadgeDetails(badgeId: string): Promise<NFTBadge | null> {
    // For now, return hardcoded badge info
    // In production, this would fetch from the database
    const badgeInfo: Record<string, NFTBadge> = {
        early_adopter: {
            id: "1",
            badgeId: "early_adopter",
            name: "Early Adopter",
            description: "One of the first 1000 users to join WorkAdventure",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "legendary",
            metadata: {},
            criteria: { max_users: 1000 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        first_invite: {
            id: "2",
            badgeId: "first_invite",
            name: "First Invitation",
            description: "Successfully invited your first friend",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "common",
            metadata: {},
            criteria: { invites_required: 1 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        super_inviter: {
            id: "3",
            badgeId: "super_inviter",
            name: "Super Inviter",
            description: "Invited 10 or more friends",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "epic",
            metadata: {},
            criteria: { invites_required: 10 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        mega_inviter: {
            id: "4",
            badgeId: "mega_inviter",
            name: "Mega Inviter",
            description: "Invited 50 or more friends",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "legendary",
            metadata: {},
            criteria: { invites_required: 50 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        ai_explorer: {
            id: "5",
            badgeId: "ai_explorer",
            name: "AI Explorer",
            description: "Interacted with AI NPCs 10 times",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "rare",
            metadata: {},
            criteria: { ai_interactions_required: 10 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        ai_master: {
            id: "6",
            badgeId: "ai_master",
            name: "AI Master",
            description: "Interacted with AI NPCs 100 times",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "legendary",
            metadata: {},
            criteria: { ai_interactions_required: 100 },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
        verified_user: {
            id: "7",
            badgeId: "verified_user",
            name: "Verified User",
            description: "Completed identity verification",
            imageUrl: null,
            contractAddress: null,
            tokenId: null,
            rarity: "rare",
            metadata: {},
            criteria: { verification_required: true },
            isActive: true,
            createdAt: new Date().toISOString(),
        },
    };

    return badgeInfo[badgeId] || null;
}
