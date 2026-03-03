<script lang="ts">
    import { onMount } from "svelte";
    import { walletStore, formattedWalletAddress, connectWallet, authenticateWithWallet, disconnectWallet, checkWalletConnection } from "../../Stores/Wallet";
    import { WALLET_AUTH_ENABLED } from "../../Enum/EnvironmentVariable";
    import WalletModal from "./WalletModal.svelte";

    export let showWalletModal = false;

    $: isConnected = $walletStore.isConnected;
    $: isAuthenticated = $walletStore.authToken !== null;
    $: isConnecting = $walletStore.isConnecting;
    $: error = $walletStore.error;
    $: address = $formattedWalletAddress;

    onMount(async () => {
        if (WALLET_AUTH_ENABLED) {
            await checkWalletConnection();
        }
    });

    async function handleConnect() {
        showWalletModal = true;
    }

    async function handleAuthenticate() {
        await authenticateWithWallet();
    }

    function handleDisconnect() {
        disconnectWallet();
    }

    function closeModal() {
        showWalletModal = false;
    }

    async function onWalletSelected(event: CustomEvent<string>) {
        const walletType = event.detail;
        showWalletModal = false;
        const address = await connectWallet(walletType);
        if (address) {
            await authenticateWithWallet();
        }
    }
</script>

{#if WALLET_AUTH_ENABLED}
    <div class="wallet-login-container">
        {#if isConnecting}
            <div class="wallet-connecting">
                <div class="spinner"></div>
                <span>Connecting...</span>
            </div>
        {:else if isConnected && isAuthenticated}
            <div class="wallet-connected">
                <div class="wallet-address" title={$walletStore.address || ""}>
                    <span class="wallet-icon">🔗</span>
                    <span class="address">{address}</span>
                </div>
                <button class="disconnect-btn" on:click={handleDisconnect}>
                    Disconnect
                </button>
            </div>
        {:else if isConnected}
            <div class="wallet-pending">
                <span class="wallet-address">{address}</span>
                <button class="auth-btn" on:click={handleAuthenticate} disabled={isConnecting}>
                    Sign to Login
                </button>
            </div>
        {:else}
            <button class="connect-btn" on:click={handleConnect}>
                <span class="wallet-icon">🔗</span>
                Connect Wallet
            </button>
        {/if}

        {#if error}
            <div class="wallet-error">
                {error}
                <button class="dismiss-btn" on:click={() => walletStore.setError('')}>×</button>
            </div>
        {/if}
    </div>

    {#if showWalletModal}
        <WalletModal
            on:selected={onWalletSelected}
            on:close={closeModal}
        />
    {/if}
{/if}

<style>
    .wallet-login-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .wallet-connecting {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #fff;
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .wallet-connected {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .wallet-address {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: #fff;
        font-size: 14px;
    }

    .wallet-icon {
        font-size: 16px;
    }

    .address {
        font-family: monospace;
    }

    .connect-btn, .auth-btn, .disconnect-btn {
        padding: 8px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
    }

    .connect-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .connect-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .auth-btn {
        background: #10b981;
        color: white;
    }

    .auth-btn:hover {
        background: #059669;
    }

    .auth-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .disconnect-btn {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        font-size: 12px;
        padding: 4px 8px;
    }

    .disconnect-btn:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .wallet-pending {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .wallet-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(239, 68, 68, 0.2);
        border: 1px solid rgba(239, 68, 68, 0.4);
        border-radius: 8px;
        color: #fca5a5;
        font-size: 12px;
        width: 100%;
    }

    .dismiss-btn {
        background: none;
        border: none;
        color: #fca5a5;
        cursor: pointer;
        font-size: 16px;
        padding: 0 4px;
    }

    .dismiss-btn:hover {
        color: #fff;
    }
</style>
