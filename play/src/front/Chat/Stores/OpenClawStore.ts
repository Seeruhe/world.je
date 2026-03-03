/**
 * OpenClaw AI Chat Store
 * Manages AI chat state and integration with WorkAdventure
 */

import { get, writable, derived, type Readable, type Writable } from "svelte/store";
import { readable } from "svelte/store";
import type { AnyKindOfUser } from "../Connection/ChatConnection";
import { getOpenClawConnection } from "../Connection/OpenClaw/OpenClawConnection";
import { OpenClawChatRoom } from "../Connection/OpenClaw/OpenClawChatRoom";
import { gameManager } from "../../Phaser/Game/GameManager";
import { isOpenClawEnabledStore, openClawConnectionStateStore } from "../../Stores/ChatStore";
import { selectedRoomStore } from "./SelectRoomStore";

/**
 * OpenClaw chat store state
 */
interface OpenClawChatState {
    enabled: boolean;
    connected: boolean;
    connectionState: "disconnected" | "connecting" | "connected" | "error";
    rooms: Map<string, OpenClawChatRoom>;
    defaultRoom: OpenClawChatRoom | null;
}

/**
 * Create the OpenClaw chat store
 */
function createOpenClawChatStore() {
    const connection = getOpenClawConnection();

    const state: Writable<OpenClawChatState> = writable({
        enabled: connection.isEnabled(),
        connected: false,
        connectionState: "disconnected" as const,
        rooms: new Map(),
        defaultRoom: null as OpenClawChatRoom | null,
    });

    // Subscribe to connection state changes
    const connectionState = connection.getConnectionState();
    const unsubConnectionState = connectionState.subscribe((connState) => {
        state.update((s) => ({
            ...s,
            connectionState: connState,
            connected: connState === "connected",
        }));
        openClawConnectionStateStore.set(connState);
    });

    // Update enabled state
    isOpenClawEnabledStore.set(connection.isEnabled());

    return {
        subscribe: state.subscribe,

        /**
         * Initialize the AI chat system
         */
        async initialize(currentUser: AnyKindOfUser): Promise<void> {
            if (!connection.isEnabled()) {
                console.log("OpenClaw is disabled, skipping initialization");
                return;
            }

            try {
                await connection.connect();

                // Create the default AI assistant room
                const pictureStore = readable<string | undefined>(undefined);
                const defaultRoom = connection.createAIChatRoom(
                    "ai-assistant-default",
                    "AI Assistant",
                    currentUser,
                    pictureStore,
                    {
                        systemPrompt: "You are a helpful AI assistant in a virtual collaboration space. Help users with questions, provide information, and assist with their tasks.",
                    }
                );

                state.update((s) => ({
                    ...s,
                    defaultRoom,
                    rooms: new Map([["ai-assistant-default", defaultRoom]]),
                }));
            } catch (error) {
                console.error("Failed to initialize OpenClaw:", error);
            }
        },

        /**
         * Get the default AI chat room
         */
        getDefaultRoom(): OpenClawChatRoom | null {
            return get(state).defaultRoom;
        },

        /**
         * Get all AI chat rooms
         */
        getRooms(): OpenClawChatRoom[] {
            return Array.from(get(state).rooms.values());
        },

        /**
         * Create a new AI chat room (e.g., for AI NPCs)
         */
        createRoom(
            roomId: string,
            name: string,
            currentUser: AnyKindOfUser,
            pictureStore: Readable<string | undefined>,
            config?: {
                type?: "ai-assistant" | "ai-npc";
                personality?: string;
                systemPrompt?: string;
                model?: string;
            }
        ): OpenClawChatRoom {
            const room = connection.createAIChatRoom(
                roomId,
                name,
                currentUser,
                pictureStore,
                config
            );

            state.update((s) => {
                const newRooms = new Map(s.rooms);
                newRooms.set(roomId, room);
                return { ...s, rooms: newRooms };
            });

            return room;
        },

        /**
         * Open the default AI chat
         */
        openAIChat(): void {
            const room = get(state).defaultRoom;
            if (room) {
                selectedRoomStore.set(room);
            }
        },

        /**
         * Check if a message should be sent to AI
         */
        shouldSendToAI(message: string): boolean {
            return connection.shouldTriggerAI(message);
        },

        /**
         * Extract message content for AI
         */
        extractAIMessage(message: string): string {
            return connection.extractMessageContent(message);
        },

        /**
         * Get the trigger prefix
         */
        getTriggerPrefix(): string {
            return connection.getTriggerPrefix();
        },

        /**
         * Cleanup
         */
        destroy(): void {
            unsubConnectionState();
            connection.destroy().catch(console.error);
        },
    };
}

export const openClawChatStore = createOpenClawChatStore();

/**
 * Derived store for AI chat room list
 */
export const aiChatRooms: Readable<OpenClawChatRoom[]> = derived(
    openClawChatStore,
    ($store) => {
        if (!$store.enabled || !$store.connected) return [];
        return Array.from($store.rooms.values());
    }
);

/**
 * Derived store for checking if AI chat is available
 */
export const isAIChatAvailable: Readable<boolean> = derived(
    openClawChatStore,
    ($store) => $store.enabled && $store.connected
);
