import { writable } from "svelte/store";

export const chatZoneLiveStore = writable(false);
export const chatVisibilityStore = writable(false);
export const chatInputFocusStore = writable(false);
export const shouldDisableChatInProximityRoomStore = writable(false);
export const intentionallyClosedChatDuringMeetingStore = writable(false);

// Call "forceRefresh" to force the refresh of the chat iframe.
function createForceRefreshChatStore() {
    const { subscribe, update } = writable({});
    return {
        subscribe,
        forceRefresh() {
            update((list) => {
                return {};
            });
        },
    };
}
export const forceRefreshChatStore = createForceRefreshChatStore();

export const isMatrixChatEnabledStore = writable(false);

// OpenClaw AI Chat stores
export const isOpenClawEnabledStore = writable(false);
export const openClawConnectionStateStore = writable<"disconnected" | "connecting" | "connected" | "error">("disconnected");

export const INITIAL_SIDEBAR_WIDTH = 335;
export const INITIAL_SIDEBAR_WIDTH_MOBILE = 250;
export const loginTokenErrorStore = writable(false);
