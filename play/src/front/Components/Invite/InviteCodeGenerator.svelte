<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import {
        inviteStore,
        inviteCodes,
        isInviteLoading,
        inviteError,
        createInviteCode,
        deactivateInviteCode,
        getInviteUrl,
        getRewardPoints,
    } from "../../Stores/Invite";
    import { isWalletAuthenticated } from "../../Stores/Wallet";

    const dispatch = createEventDispatcher();

    let showCreateForm = false;
    let maxUses = -1;
    let copiedCode = "";
    let copiedTimeout: ReturnType<typeof setTimeout>;

    $: codes = $inviteCodes;
    $: isLoading = $isInviteLoading;
    $: error = $inviteError;
    $: isAuthenticated = $isWalletAuthenticated;

    async function handleCreateCode() {
        const code = await createInviteCode(maxUses);
        if (code) {
            showCreateForm = false;
            maxUses = -1;
        }
    }

    async function handleDeactivate(codeId: string) {
        if (confirm("Are you sure you want to deactivate this invite code?")) {
            await deactivateInviteCode(codeId);
        }
    }

    function copyToClipboard(code: string) {
        const url = getInviteUrl(code);
        navigator.clipboard.writeText(url);
        copiedCode = code;
        if (copiedTimeout) clearTimeout(copiedTimeout);
        copiedTimeout = setTimeout(() => {
            copiedCode = "";
        }, 2000);
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return "Never";
        return new Date(dateStr).toLocaleDateString();
    }

    function getUsesText(code: { maxUses: number; currentUses: number }): string {
        if (code.maxUses === -1) {
            return `${code.currentUses} uses (unlimited)`;
        }
        return `${code.currentUses} / ${code.maxUses} uses`;
    }
</script>

<div class="invite-generator">
    <div class="header">
        <h3>Invite Friends</h3>
        <p class="subtitle">Earn {getRewardPoints()} points for each friend who joins!</p>
    </div>

    {#if error}
        <div class="error-message">
            {error}
            <button class="dismiss" on:click={() => inviteStore.setError('')}>×</button>
        </div>
    {/if}

    {#if !isAuthenticated}
        <div class="not-authenticated">
            <p>Please connect your wallet to generate invite codes.</p>
        </div>
    {:else}
        {#if showCreateForm}
            <div class="create-form">
                <label>
                    <span>Maximum Uses</span>
                    <select bind:value={maxUses}>
                        <option value={-1}>Unlimited</option>
                        <option value={1}>1 use</option>
                        <option value={5}>5 uses</option>
                        <option value={10}>10 uses</option>
                        <option value={50}>50 uses</option>
                        <option value={100}>100 uses</option>
                    </select>
                </label>
                <div class="form-actions">
                    <button class="btn-cancel" on:click={() => showCreateForm = false}>Cancel</button>
                    <button class="btn-create" on:click={handleCreateCode} disabled={isLoading}>
                        {isLoading ? "Creating..." : "Create Code"}
                    </button>
                </div>
            </div>
        {:else}
            <button class="btn-new-code" on:click={() => showCreateForm = true}>
                + Generate New Code
            </button>
        {/if}

        {#if codes.length > 0}
            <div class="codes-list">
                <h4>Your Invite Codes</h4>
                {#each codes as code (code.id)}
                    <div class="code-item" class:inactive={!code.isActive}>
                        <div class="code-header">
                            <span class="code-value">{code.code}</span>
                            {#if !code.isActive}
                                <span class="badge inactive">Inactive</span>
                            {:else if code.maxUses > 0 && code.currentUses >= code.maxUses}
                                <span class="badge used">Used Up</span>
                            {:else}
                                <span class="badge active">Active</span>
                            {/if}
                        </div>
                        <div class="code-details">
                            <span class="uses">{getUsesText(code)}</span>
                            <span class="expires">Expires: {formatDate(code.expiresAt)}</span>
                        </div>
                        <div class="code-actions">
                            <button
                                class="btn-copy"
                                on:click={() => copyToClipboard(code.code)}
                                disabled={!code.isActive}
                            >
                                {copiedCode === code.code ? "Copied!" : "Copy Link"}
                            </button>
                            {#if code.isActive}
                                <button class="btn-deactivate" on:click={() => handleDeactivate(code.id)}>
                                    Deactivate
                                </button>
                            {/if}
                        </div>
                    </div>
                {/each}
            </div>
        {:else if !showCreateForm}
            <div class="no-codes">
                <p>You haven't created any invite codes yet.</p>
            </div>
        {/if}
    {/if}
</div>

<style>
    .invite-generator {
        background: #1a1b20;
        border-radius: 12px;
        padding: 20px;
        color: #fff;
    }

    .header {
        margin-bottom: 20px;
    }

    .header h3 {
        margin: 0 0 4px 0;
        font-size: 18px;
    }

    .subtitle {
        margin: 0;
        color: #9ca3af;
        font-size: 14px;
    }

    .error-message {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #fca5a5;
        margin-bottom: 16px;
    }

    .error-message .dismiss {
        background: none;
        border: none;
        color: #fca5a5;
        cursor: pointer;
        font-size: 18px;
    }

    .not-authenticated {
        text-align: center;
        padding: 24px;
        color: #9ca3af;
    }

    .btn-new-code {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border: none;
        border-radius: 8px;
        color: #fff;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .btn-new-code:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .create-form {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
    }

    .create-form label {
        display: block;
        margin-bottom: 12px;
    }

    .create-form label span {
        display: block;
        margin-bottom: 4px;
        color: #9ca3af;
        font-size: 12px;
    }

    .create-form select {
        width: 100%;
        padding: 8px 12px;
        background: #2d2e35;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        color: #fff;
    }

    .form-actions {
        display: flex;
        gap: 12px;
    }

    .form-actions button {
        flex: 1;
        padding: 10px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-cancel {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
    }

    .btn-create {
        background: #10b981;
        color: #fff;
    }

    .btn-create:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .codes-list {
        margin-top: 20px;
    }

    .codes-list h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #9ca3af;
    }

    .code-item {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 8px;
    }

    .code-item.inactive {
        opacity: 0.5;
    }

    .code-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .code-value {
        font-family: monospace;
        font-size: 16px;
        font-weight: 600;
    }

    .badge {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
    }

    .badge.active {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
    }

    .badge.inactive, .badge.used {
        background: rgba(107, 114, 128, 0.2);
        color: #6b7280;
    }

    .code-details {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #6b7280;
        margin-bottom: 8px;
    }

    .code-actions {
        display: flex;
        gap: 8px;
    }

    .code-actions button {
        padding: 6px 12px;
        border-radius: 4px;
        border: none;
        font-size: 12px;
        cursor: pointer;
    }

    .btn-copy {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
    }

    .btn-copy:hover {
        background: rgba(99, 102, 241, 0.3);
    }

    .btn-copy:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-deactivate {
        background: rgba(239, 68, 68, 0.2);
        color: #f87171;
    }

    .no-codes {
        text-align: center;
        padding: 24px;
        color: #6b7280;
    }
</style>
