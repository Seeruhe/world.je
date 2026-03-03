<script lang="ts">
    import { onMount } from "svelte";
    import {
        inviteStats,
        isInviteLoading,
        fetchInviteStats,
        getRewardPoints,
    } from "../../Stores/Invite";
    import { isWalletAuthenticated, walletStore } from "../../Stores/Wallet";

    $: stats = $inviteStats;
    $: isLoading = $isInviteLoading;
    $: isAuthenticated = $isWalletAuthenticated;

    onMount(() => {
        if ($isWalletAuthenticated) {
            fetchInviteStats();
        }
    });

    // Watch for wallet authentication changes
    $: if ($isWalletAuthenticated && !stats) {
        fetchInviteStats();
    }
</script>

<div class="invite-stats">
    <h3>Your Invite Stats</h3>

    {#if !isAuthenticated}
        <div class="not-authenticated">
            <p>Connect your wallet to see your invite statistics.</p>
        </div>
    {:else if isLoading}
        <div class="loading">
            <div class="spinner"></div>
            <span>Loading stats...</span>
        </div>
    {:else if stats}
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{stats.totalInvites}</div>
                <div class="stat-label">Total Invites</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats.successfulInvites}</div>
                <div class="stat-label">Successful</div>
            </div>
            <div class="stat-card highlight">
                <div class="stat-value">{stats.totalPointsEarned}</div>
                <div class="stat-label">Points Earned</div>
            </div>
        </div>

        <div class="info-box">
            <p>Earn <strong>{getRewardPoints()} points</strong> for each friend who joins using your invite link!</p>
        </div>
    {:else}
        <div class="no-stats">
            <p>No invite statistics available yet.</p>
            <button on:click={fetchInviteStats}>Refresh Stats</button>
        </div>
    {/if}
</div>

<style>
    .invite-stats {
        background: #1a1b20;
        border-radius: 12px;
        padding: 20px;
        color: #fff;
    }

    h3 {
        margin: 0 0 16px 0;
        font-size: 18px;
    }

    .not-authenticated, .no-stats {
        text-align: center;
        padding: 24px;
        color: #9ca3af;
    }

    .no-stats button {
        margin-top: 12px;
        padding: 8px 16px;
        background: rgba(99, 102, 241, 0.2);
        border: none;
        border-radius: 6px;
        color: #818cf8;
        cursor: pointer;
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

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 16px;
    }

    .stat-card {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px;
        text-align: center;
    }

    .stat-card.highlight {
        background: rgba(16, 185, 129, 0.1);
        border-color: rgba(16, 185, 129, 0.3);
    }

    .stat-value {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 4px;
    }

    .stat-card.highlight .stat-value {
        color: #10b981;
    }

    .stat-label {
        font-size: 12px;
        color: #9ca3af;
    }

    .info-box {
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.2);
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        font-size: 14px;
        color: #a5b4fc;
    }

    .info-box strong {
        color: #c7d2fe;
    }

    @media (max-width: 480px) {
        .stats-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
