<script lang="ts">
    import { onMount } from "svelte";
    import {
        userBadges,
        badgesByRarity,
        isBadgeLoading,
        fetchUserBadges,
        getRarityColor,
        getRarityGradient,
        getDefaultBadgeImage,
    } from "../../Stores/Badge";
    import { isWalletAuthenticated } from "../../Stores/Wallet";

    let selectedBadge: string | null = null;

    $: badges = $userBadges;
    $: grouped = $badgesByRarity;
    $: isLoading = $isBadgeLoading;
    $: isAuthenticated = $isWalletAuthenticated;

    onMount(() => {
        if ($isWalletAuthenticated) {
            fetchUserBadges();
        }
    });

    $: if ($isWalletAuthenticated && badges.length === 0 && !isLoading) {
        fetchUserBadges();
    }

    function selectBadge(badgeId: string) {
        selectedBadge = selectedBadge === badgeId ? null : badgeId;
    }

    function getTotalBadges(): number {
        return badges.length;
    }

    function getRarityCount(rarity: string): number {
        return grouped[rarity]?.length || 0;
    }
</script>

<div class="badge-showcase">
    <div class="header">
        <h3>Your Badges</h3>
        <span class="badge-count">{getTotalBadges()} badges</span>
    </div>

    {#if !isAuthenticated}
        <div class="not-authenticated">
            <p>Connect your wallet to see your badges.</p>
        </div>
    {:else if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <span>Loading badges...</span>
        </div>
    {:else if badges.length === 0}
        <div class="no-badges">
            <div class="empty-icon">🏆</div>
            <p>You haven't earned any badges yet.</p>
            <p class="hint">Invite friends and explore to earn badges!</p>
        </div>
    {:else}
        <div class="rarity-summary">
            {#if getRarityCount('legendary') > 0}
                <span class="rarity-badge legendary">👑 {getRarityCount('legendary')} Legendary</span>
            {/if}
            {#if getRarityCount('epic') > 0}
                <span class="rarity-badge epic">💜 {getRarityCount('epic')} Epic</span>
            {/if}
            {#if getRarityCount('rare') > 0}
                <span class="rarity-badge rare">💙 {getRarityCount('rare')} Rare</span>
            {/if}
            {#if getRarityCount('common') > 0}
                <span class="rarity-badge common">⚪ {getRarityCount('common')} Common</span>
            {/if}
        </div>

        <div class="badges-grid">
            {#each ['legendary', 'epic', 'rare', 'common'] as rarity}
                {#each grouped[rarity] || [] as userBadge (userBadge.id)}
                    <button
                        class="badge-item"
                        class:selected={selectedBadge === userBadge.badgeId}
                        style="--rarity-color: {getRarityColor(rarity)}; --rarity-gradient: {getRarityGradient(rarity)}"
                        on:click={() => selectBadge(userBadge.badgeId)}
                    >
                        <div class="badge-icon">
                            {getDefaultBadgeImage(userBadge.badgeId)}
                        </div>
                        <div class="badge-name">{userBadge.badge?.name || userBadge.badgeId}</div>
                    </button>
                {/each}
            {/each}
        </div>

        {#if selectedBadge}
            {@const selected = badges.find(b => b.badgeId === selectedBadge)}
            {#if selected && selected.badge}
                <div class="badge-details">
                    <div class="details-header">
                        <span class="details-icon">{getDefaultBadgeImage(selectedBadge)}</span>
                        <div>
                            <h4>{selected.badge.name}</h4>
                            <span class="details-rarity" style="color: {getRarityColor(selected.badge.rarity)}">
                                {selected.badge.rarity.charAt(0).toUpperCase() + selected.badge.rarity.slice(1)}
                            </span>
                        </div>
                    </div>
                    <p class="details-description">{selected.badge.description}</p>
                    <p class="details-date">Acquired: {new Date(selected.acquiredAt).toLocaleDateString()}</p>
                </div>
            {/if}
        {/if}
    {/if}
</div>

<style>
    .badge-showcase {
        background: #1a1b20;
        border-radius: 12px;
        padding: 20px;
        color: #fff;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }

    .header h3 {
        margin: 0;
        font-size: 18px;
    }

    .badge-count {
        font-size: 12px;
        color: #9ca3af;
        background: rgba(255, 255, 255, 0.1);
        padding: 4px 8px;
        border-radius: 4px;
    }

    .not-authenticated, .no-badges {
        text-align: center;
        padding: 32px;
        color: #9ca3af;
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
    }

    .hint {
        font-size: 12px;
        color: #6b7280;
    }

    .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 24px;
        color: #9ca3af;
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .rarity-summary {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
    }

    .rarity-badge {
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
    }

    .rarity-badge.legendary { color: #f59e0b; }
    .rarity-badge.epic { color: #8b5cf6; }
    .rarity-badge.rare { color: #3b82f6; }
    .rarity-badge.common { color: #6b7280; }

    .badges-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
        gap: 12px;
    }

    .badge-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 8px;
        background: rgba(255, 255, 255, 0.05);
        border: 2px solid transparent;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
    }

    .badge-item:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--rarity-color);
    }

    .badge-item.selected {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--rarity-color);
        box-shadow: 0 0 12px var(--rarity-color);
    }

    .badge-icon {
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        margin-bottom: 4px;
        background: var(--rarity-gradient);
        border-radius: 50%;
    }

    .badge-name {
        font-size: 10px;
        text-align: center;
        color: #9ca3af;
        line-height: 1.2;
    }

    .badge-details {
        margin-top: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .details-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .details-icon {
        font-size: 32px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
    }

    .details-header h4 {
        margin: 0;
        font-size: 16px;
    }

    .details-rarity {
        font-size: 12px;
        text-transform: uppercase;
        font-weight: 500;
    }

    .details-description {
        margin: 0 0 8px 0;
        color: #9ca3af;
        font-size: 14px;
    }

    .details-date {
        margin: 0;
        font-size: 12px;
        color: #6b7280;
    }
</style>
