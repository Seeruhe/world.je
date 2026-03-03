import { writable, derived, get } from "svelte/store";
import { PUSHER_URL, WALLET_AUTH_ENABLED, WALLET_CHAIN_ID, WALLET_PROJECT_ID } from "../../Enum/EnvironmentVariable";

// Browser detection
const isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined";

export interface WalletState {
    isConnected: boolean;
    isConnecting: boolean;
    address: string | null;
    chainId: number | null;
    error: string | null;
    authToken: string | null;
    userUuid: string | null;
    isNewUser: boolean;
}

export interface WalletUser {
    walletAddress: string;
    userUuid: string;
    username?: string;
    points: number;
    level: number;
    badges: string[];
}

const WALLET_STORAGE_KEY = "wallet_auth_token";
const WALLET_ADDRESS_KEY = "wallet_address";

// Create the main wallet store
function createWalletStore() {
    const initialState: WalletState = {
        isConnected: false,
        isConnecting: false,
        address: null,
        chainId: null,
        error: null,
        authToken: null,
        userUuid: null,
        isNewUser: false,
    };

    const { subscribe, set, update } = writable<WalletState>(initialState);

    // Load saved state from localStorage
    if (isBrowser) {
        const savedToken = localStorage.getItem(WALLET_STORAGE_KEY);
        const savedAddress = localStorage.getItem(WALLET_ADDRESS_KEY);
        if (savedToken && savedAddress) {
            update((state) => ({
                ...state,
                authToken: savedToken,
                address: savedAddress,
                isConnected: true,
            }));
        }
    }

    return {
        subscribe,
        setConnecting: (connecting: boolean) =>
            update((state) => ({ ...state, isConnecting: connecting, error: null })),
        setConnected: (address: string, chainId: number) =>
            update((state) => ({ ...state, isConnected: true, address, chainId, isConnecting: false })),
        setAuthenticated: (authToken: string, userUuid: string, isNewUser: boolean = false) => {
            if (isBrowser) {
                localStorage.setItem(WALLET_STORAGE_KEY, authToken);
                if (get({ subscribe }).address) {
                    localStorage.setItem(WALLET_ADDRESS_KEY, get({ subscribe }).address!);
                }
            }
            update((state) => ({
                ...state,
                authToken,
                userUuid,
                isNewUser,
                isConnecting: false,
                error: null,
            }));
        },
        setError: (error: string) =>
            update((state) => ({ ...state, error, isConnecting: false })),
        disconnect: () => {
            if (isBrowser) {
                localStorage.removeItem(WALLET_STORAGE_KEY);
                localStorage.removeItem(WALLET_ADDRESS_KEY);
            }
            set(initialState);
        },
        reset: () => set(initialState),
    };
}

export const walletStore = createWalletStore();

// Derived stores
export const isWalletConnected = derived(walletStore, ($wallet) => $wallet.isConnected);
export const isWalletAuthenticated = derived(walletStore, ($wallet) => $wallet.authToken !== null);
export const walletAddress = derived(walletStore, ($wallet) => $wallet.address);
export const walletError = derived(walletStore, ($wallet) => $wallet.error);

// Format wallet address for display (0x1234...5678)
export const formattedWalletAddress = derived(walletStore, ($wallet) => {
    if (!$wallet.address) return null;
    return `${$wallet.address.slice(0, 6)}...${$wallet.address.slice(-4)}`;
});

// Wallet connection and authentication functions
export async function connectWallet(walletType: string = "metamask"): Promise<string | null> {
    if (!WALLET_AUTH_ENABLED) {
        walletStore.setError("Wallet authentication is not enabled");
        return null;
    }

    walletStore.setConnecting(true);

    try {
        let address: string;
        let chainId: number;

        if (walletType === "metamask" || walletType === "injected") {
            const result = await connectMetaMask();
            if (!result) return null;
            address = result.address;
            chainId = result.chainId;
        } else {
            // For other wallets (WalletConnect, etc.), we would need wagmi integration
            walletStore.setError(`Wallet type "${walletType}" not yet supported`);
            return null;
        }

        walletStore.setConnected(address, chainId);
        return address;
    } catch (err) {
        console.error("Failed to connect wallet:", err);
        walletStore.setError(err instanceof Error ? err.message : "Failed to connect wallet");
        return null;
    }
}

async function connectMetaMask(): Promise<{ address: string; chainId: number } | null> {
    if (typeof window === "undefined" || !(window as any).ethereum) {
        walletStore.setError("MetaMask is not installed. Please install MetaMask to continue.");
        return null;
    }

    try {
        const ethereum = (window as any).ethereum;

        // Request account access
        const accounts: string[] = await ethereum.request({
            method: "eth_requestAccounts",
        });

        if (!accounts || accounts.length === 0) {
            walletStore.setError("No accounts found. Please unlock MetaMask.");
            return null;
        }

        // Get chain ID
        const chainIdHex: string = await ethereum.request({ method: "eth_chainId" });
        const chainId = parseInt(chainIdHex, 16);

        // Check if we're on the correct chain
        if (chainId !== WALLET_CHAIN_ID) {
            console.warn(`Connected to chain ${chainId}, expected ${WALLET_CHAIN_ID}`);
        }

        // Listen for account changes
        ethereum.on("accountsChanged", (accounts: string[]) => {
            if (accounts.length === 0) {
                walletStore.disconnect();
            } else {
                walletStore.setConnected(accounts[0].toLowerCase(), chainId);
            }
        });

        // Listen for chain changes
        ethereum.on("chainChanged", (chainIdHex: string) => {
            const newChainId = parseInt(chainIdHex, 16);
            walletStore.setConnected(
                (get(walletStore).address || "").toLowerCase(),
                newChainId
            );
        });

        return { address: accounts[0].toLowerCase(), chainId };
    } catch (err: any) {
        if (err.code === 4001) {
            walletStore.setError("Connection rejected by user");
        } else {
            walletStore.setError(err.message || "Failed to connect to MetaMask");
        }
        return null;
    }
}

export async function authenticateWithWallet(): Promise<boolean> {
    const state = get(walletStore);

    if (!state.address) {
        walletStore.setError("No wallet connected");
        return false;
    }

    walletStore.setConnecting(true);

    try {
        // Step 1: Get nonce from server
        const nonceResponse = await fetch(`${PUSHER_URL}/wallet/nonce`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress: state.address }),
        });

        if (!nonceResponse.ok) {
            const error = await nonceResponse.json();
            throw new Error(error.error || "Failed to get nonce");
        }

        const { nonce, message } = await nonceResponse.json();

        // Step 2: Sign the message
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
            throw new Error("Ethereum provider not found");
        }

        const signature = await ethereum.request({
            method: "personal_sign",
            params: [message, state.address],
        });

        // Step 3: Verify signature with server
        const verifyResponse = await fetch(`${PUSHER_URL}/wallet/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                walletAddress: state.address,
                signature,
                nonce,
                chainId: state.chainId,
            }),
        });

        if (!verifyResponse.ok) {
            const error = await verifyResponse.json();
            throw new Error(error.error || "Signature verification failed");
        }

        const verifyData = await verifyResponse.json();

        if (verifyData.success) {
            walletStore.setAuthenticated(
                verifyData.authToken,
                verifyData.userUuid,
                verifyData.isNewUser
            );
            return true;
        } else {
            throw new Error(verifyData.error || "Authentication failed");
        }
    } catch (err) {
        console.error("Wallet authentication failed:", err);
        walletStore.setError(err instanceof Error ? err.message : "Authentication failed");
        return false;
    }
}

export async function getWalletUserInfo(): Promise<WalletUser | null> {
    const state = get(walletStore);

    if (!state.authToken) {
        return null;
    }

    try {
        const response = await fetch(`${PUSHER_URL}/wallet/me?token=${state.authToken}`);

        if (!response.ok) {
            if (response.status === 401) {
                walletStore.disconnect();
            }
            return null;
        }

        return await response.json();
    } catch (err) {
        console.error("Failed to get wallet user info:", err);
        return null;
    }
}

export function disconnectWallet() {
    walletStore.disconnect();
}

// Check if wallet is already connected on page load
export async function checkWalletConnection(): Promise<boolean> {
    if (!isBrowser || !WALLET_AUTH_ENABLED) return false;

    const ethereum = (window as any).ethereum;
    if (!ethereum) return false;

    try {
        const accounts: string[] = await ethereum.request({ method: "eth_accounts" });
        if (accounts && accounts.length > 0) {
            const chainIdHex: string = await ethereum.request({ method: "eth_chainId" });
            const chainId = parseInt(chainIdHex, 16);
            walletStore.setConnected(accounts[0].toLowerCase(), chainId);
            return true;
        }
    } catch (err) {
        console.error("Failed to check wallet connection:", err);
    }

    return false;
}
