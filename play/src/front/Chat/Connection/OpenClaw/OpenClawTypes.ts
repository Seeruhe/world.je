/**
 * OpenClaw connection types for WorkAdventure chat integration
 */

import type { Readable, Writable } from "svelte/store";
import type { AvailabilityStatus } from "@workadventure/messages";
import type { PictureStore } from "../../../Stores/PictureStore";

/**
 * OpenClaw AI user representation
 */
export interface OpenClawAIUser {
    chatId: string;
    uuid: string;
    availabilityStatus: Readable<AvailabilityStatus>;
    username: string;
    pictureStore: PictureStore | undefined;
    roomName: undefined;
    playUri: undefined;
    isAdmin: boolean;
    isMember: false;
    color: undefined;
    spaceUserId: undefined;
}

/**
 * OpenClaw chat room type
 */
export type OpenClawRoomType = "ai-assistant" | "ai-npc";

/**
 * OpenClaw chat room configuration
 */
export interface OpenClawRoomConfig {
    /** Room ID */
    id: string;
    /** Room name */
    name: string;
    /** Room type */
    type: OpenClawRoomType;
    /** NPC personality (for AI NPCs) */
    personality?: string;
    /** System prompt */
    systemPrompt?: string;
    /** Model override */
    model?: string;
}

/**
 * OpenClaw connection state
 */
export type OpenClawConnectionState = "disconnected" | "connecting" | "connected" | "error";

/**
 * OpenClaw settings
 */
export interface OpenClawSettings {
    enabled: boolean;
    gatewayUrl: string;
    apiKey?: string;
    defaultModel: string;
    triggerPrefix: string;
}

/**
 * OpenClaw session info
 */
export interface OpenClawSession {
    sessionId: string;
    roomId: string;
    userId: string;
    createdAt: number;
    lastActivityAt: number;
    messageCount: number;
}

/**
 * OpenClaw message metadata
 */
export interface OpenClawMessageMetadata {
    model?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: "stop" | "length" | "error";
}
