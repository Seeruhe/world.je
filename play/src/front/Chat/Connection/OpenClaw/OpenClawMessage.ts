/**
 * OpenClaw chat message implementation
 */

import { writable, type Readable } from "svelte/store";
import type { ChatMessage, ChatMessageContent, ChatMessageReaction, ChatMessageType, AnyKindOfUser } from "../ChatConnection";
import { MapStore } from "@workadventure/store-utils";

/**
 * OpenClaw chat message implementation
 */
export class OpenClawChatMessage implements ChatMessage {
    isQuotedMessage = undefined;
    quotedMessage = undefined;
    isDeleted = writable(false);
    isModified = writable(false);
    canDelete = writable(false);
    reactions: MapStore<string, ChatMessageReaction> = new MapStore();

    constructor(
        public id: string,
        public sender: AnyKindOfUser | undefined,
        public content: Readable<ChatMessageContent>,
        public date: Date | null,
        public isMyMessage: boolean,
        public type: ChatMessageType,
        public metadata?: {
            model?: string;
            usage?: {
                promptTokens: number;
                completionTokens: number;
                totalTokens: number;
            };
        }
    ) {}

    remove(): void {
        // AI messages cannot be removed by regular users
        console.info("OpenClaw messages cannot be removed");
    }

    edit(_newContent: string): Promise<void> {
        // AI messages cannot be edited
        console.info("OpenClaw messages cannot be edited");
        return Promise.resolve();
    }

    addReaction(_reaction: string): Promise<void> {
        // Reactions not supported for AI messages yet
        console.info("Reactions not supported for AI messages");
        return Promise.resolve();
    }
}

/**
 * Create a user message for OpenClaw chat
 */
export function createUserMessage(
    id: string,
    content: string,
    sender: AnyKindOfUser
): OpenClawChatMessage {
    return new OpenClawChatMessage(
        id,
        sender,
        writable({ body: content, url: undefined }),
        new Date(),
        true,
        "text"
    );
}

/**
 * Create an AI response message
 */
export function createAIMessage(
    id: string,
    content: string,
    aiUser: AnyKindOfUser,
    metadata?: {
        model?: string;
        usage?: {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
        };
    }
): OpenClawChatMessage {
    return new OpenClawChatMessage(
        id,
        aiUser,
        writable({ body: content, url: undefined }),
        new Date(),
        false,
        "text",
        metadata
    );
}
