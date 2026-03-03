<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { WALLET_PROJECT_ID } from "../../Enum/EnvironmentVariable";

    const dispatch = createEventDispatcher();

    interface WalletOption {
        id: string;
        name: string;
        icon: string;
        description: string;
        installed?: boolean;
        available: boolean;
    }

    const wallets: WalletOption[] = [
        {
            id: "metamask",
            name: "MetaMask",
            icon: "🦊",
            description: "Connect using MetaMask wallet",
            available: true,
        },
        {
            id: "coinbase",
            name: "Coinbase Wallet",
            icon: "🔵",
            description: "Connect using Coinbase Wallet",
            available: false,
        },
        {
            id: "rainbow",
            name: "Rainbow",
            icon: "🌈",
            description: "Connect using Rainbow wallet",
            available: false,
        },
        {
            id: "walletconnect",
            name: "WalletConnect",
            icon: "📱",
            description: "Scan with your mobile wallet",
            available: WALLET_PROJECT_ID !== undefined,
        },
        {
            id: "trust",
            name: "Trust Wallet",
            icon: "🛡️",
            description: "Connect using Trust Wallet",
            available: false,
        },
    ];

    $: metamaskInstalled = typeof window !== "undefined" && (window as any).ethereum?.isMetaMask;

    function selectWallet(walletId: string) {
        const wallet = wallets.find(w => w.id === walletId);
        if (wallet?.id === "metamask" || wallet?.id === "injected") {
            dispatch("selected", walletId);
        } else if (wallet?.available) {
            dispatch("selected", walletId);
        } else {
            // Show coming soon message or redirect to install
            console.log(`Wallet ${wallet?.name} coming soon`);
        }
    }

    function close() {
        dispatch("close");
    }

    function handleBackdropClick(e: MouseEvent) {
        if (e.target === e.currentTarget) {
            close();
        }
    }
</script>

<svelte:window on:keydown={(e) => e.key === "Escape" && close()} />

<div class="modal-backdrop" on:click={handleBackdropClick} role="dialog" aria-modal="true">
    <div class="modal-content">
        <div class="modal-header">
            <h2>Connect Your Wallet</h2>
            <button class="close-btn" on:click={close} aria-label="Close modal">×</button>
        </div>

        <div class="modal-body">
            <p class="modal-description">
                Select a wallet to connect to WorkAdventure. Your wallet will be used for authentication.
            </p>

            <div class="wallet-list">
                {#each wallets as wallet}
                    <button
                        class="wallet-option"
                        class:disabled={!wallet.available && wallet.id !== 'metamask'}
                        class:installed={wallet.id === 'metamask' && metamaskInstalled}
                        on:click={() => selectWallet(wallet.id)}
                        disabled={!wallet.available && wallet.id !== 'metamask'}
                    >
                        <div class="wallet-icon">{wallet.icon}</div>
                        <div class="wallet-info">
                            <span class="wallet-name">{wallet.name}</span>
                            <span class="wallet-description">
                                {#if wallet.id === 'metamask'}
                                    {metamaskInstalled ? 'Detected' : 'Not installed'}
                                {:else if !wallet.available}
                                    Coming soon
                                {:else}
                                    {wallet.description}
                                {/if}
                            </span>
                        </div>
                        {#if wallet.id === 'metamask' && metamaskInstalled}
                            <span class="badge detected">Detected</span>
                        {:else if wallet.id === 'metamask' && !metamaskInstalled}
                            <span class="badge install">Install</span>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <div class="modal-footer">
            <p class="footer-text">
                New to wallets? <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer">Get MetaMask</a>
            </p>
        </div>
    </div>
</div>

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(4px);
    }

    .modal-content {
        background: #1a1b20;
        border-radius: 16px;
        width: 100%;
        max-width: 420px;
        margin: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .modal-header h2 {
        margin: 0;
        color: #fff;
        font-size: 20px;
        font-weight: 600;
    }

    .close-btn {
        background: none;
        border: none;
        color: #9ca3af;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .close-btn:hover {
        color: #fff;
    }

    .modal-body {
        padding: 24px;
    }

    .modal-description {
        color: #9ca3af;
        font-size: 14px;
        margin: 0 0 20px 0;
    }

    .wallet-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .wallet-option {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        width: 100%;
        text-align: left;
    }

    .wallet-option:hover:not(.disabled) {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
    }

    .wallet-option.disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .wallet-option.installed {
        border-color: #10b981;
    }

    .wallet-icon {
        font-size: 32px;
        width: 48px;
        height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
    }

    .wallet-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .wallet-name {
        color: #fff;
        font-weight: 500;
        font-size: 16px;
    }

    .wallet-description {
        color: #9ca3af;
        font-size: 12px;
    }

    .badge {
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
    }

    .badge.detected {
        background: rgba(16, 185, 129, 0.2);
        color: #10b981;
    }

    .badge.install {
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
    }

    .modal-footer {
        padding: 16px 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .footer-text {
        margin: 0;
        color: #6b7280;
        font-size: 12px;
        text-align: center;
    }

    .footer-text a {
        color: #818cf8;
        text-decoration: none;
    }

    .footer-text a:hover {
        text-decoration: underline;
    }
</style>
