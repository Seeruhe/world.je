/**
 * OpenClaw chat room implementation
 */

import { writable, readable, get, type Readable, type Writable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
import type { ChatRoom, ChatMessage, AnyKindOfUser } from "../ChatConnection";
import { SearchableArrayStore } from "@workadventure/store-utils";
import type { PictureStore } from "../../../Stores/PictureStore";
import type { OpenClawConnection } from "./OpenClawConnection";
import { OpenClawChatMessage, createUserMessage, createAIMessage } from "./OpenClawMessage";
import type { OpenClawRoomConfig } from "./OpenClawTypes";
import type { AvailabilityStatus } from "@workadventure/messages";

/**
 * OpenClaw chat room - represents an AI chat session
 */
export class OpenClawChatRoom implements ChatRoom {
    readonly id: string;
    readonly name: Writable<string>;
    readonly type: "direct" | "multiple" = "direct";
    readonly hasUnreadMessages = writable(false);
    readonly unreadNotificationCount = writable(0);
    readonly pictureStore: PictureStore;
    readonly messages: SearchableArrayStore<string, ChatMessage> = new SearchableArrayStore((item) => item.id);
    readonly hasPreviousMessage = writable(false);
    readonly isEncrypted = writable(false);
    readonly typingMembers = writable<Array<{ id: string; name: string | null; pictureStore: PictureStore }>>([]);
    readonly isRoomFolder = false;
    lastMessageTimestamp = 0;

    private sessionId: string | null = null;
    private isProcessing = false;
    private readonly aiUser: AnyKindOfUser;

    constructor(
        private connection: OpenClawConnection,
        private config: OpenClawRoomConfig,
        private currentUser: AnyKindOfUser,
        pictureStore: PictureStore
    ) {
        this.id = config.id;
        this.name = writable(config.name);
        this.pictureStore = pictureStore;

        // Create AI user representation
        this.aiUser = {
            chatId: `ai-${config.id}`,
            uuid: `ai-${config.id}`,
            availabilityStatus: readable("ONLINE" as unknown as AvailabilityStatus),
            username: config.name,
            pictureStore,
            roomName: undefined,
            playUri: undefined,
            isAdmin: false,
            isMember: false,
            color: undefined,
            spaceUserId: undefined,
        };
    }

    /**
     * Get the AI user for this room
     */
    getAIUser(): AnyKindOfUser {
        return this.aiUser;
    }

    /**
     * Set the session ID for this chat room
     */
    setSessionId(sessionId: string): void {
        this.sessionId = sessionId;
    }

    /**
     * Get the current session ID
     */
    getSessionId(): string | null {
        return this.sessionId;
    }

    /**
     * Send a message to the AI
     */
    async sendMessage(message: string): Promise<void> {
        if (this.isProcessing) {
            console.warn("Already processing a message, please wait");
            return;
        }

        // Add user message to the chat
        const userMessage = createUserMessage(
            uuidv4(),
            message,
            this.currentUser
        );
        this.messages.push(userMessage);
        this.lastMessageTimestamp = userMessage.date?.getTime() ?? Date.now();

        // Show typing indicator
        this.typingMembers.set([{
            id: this.aiUser.chatId || `ai-${this.config.id}`,
            name: (this.aiUser.username as string) || "AI",
            pictureStore: this.pictureStore,
        }]);

        this.isProcessing = true;

        try {
            // Build conversation history
            const conversationHistory = this.messages.map((msg) => ({
                role: msg.isMyMessage ? "user" as const : "assistant" as const,
                content: get(msg.content).body,
            }));

            // Send to OpenClaw
            const response = await this.connection.sendChatMessage({
                messages: conversationHistory,
                sessionId: this.sessionId ?? undefined,
                systemPrompt: this.config.systemPrompt,
                model: this.config.model,
            });

            // Update session ID if provided
            if (response.sessionId && !this.sessionId) {
                this.sessionId = response.sessionId;
            }

            // Add AI response to the chat
            const aiMessage = createAIMessage(
                uuidv4(),
                response.content,
                this.aiUser,
                {
                    model: response.model,
                    usage: response.usage,
                }
            );
            this.messages.push(aiMessage);
            this.lastMessageTimestamp = aiMessage.date?.getTime() ?? Date.now();

            // Mark as unread if not selected
            this.hasUnreadMessages.set(true);
            this.unreadNotificationCount.update((n) => n + 1);

        } catch (error) {
            console.error("Failed to send message to OpenClaw:", error);

            // Add error message
            const errorMessage = createAIMessage(
                uuidv4(),
                "Sorry, I encountered an error processing your message. Please try again.",
                this.aiUser
            );
            this.messages.push(errorMessage);

        } finally {
            this.isProcessing = false;
            this.typingMembers.set([]);
        }
    }

    /**
     * Send files (not supported for AI chat)
     */
    async sendFiles(_files: FileList): Promise<void> {
        console.info("File uploads are not supported in AI chat");
        return Promise.resolve();
    }

    /**
     * Mark timeline as read
     */
    setTimelineAsRead(): void {
        this.hasUnreadMessages.set(false);
        this.unreadNotificationCount.set(0);
    }

    /**
     * Load more previous messages (not supported)
     */
    async loadMorePreviousMessages(): Promise<void> {
        // AI chat doesn't support history loading
        return Promise.resolve();
    }

    /**
     * Start typing indicator (sent automatically with message)
     */
    async startTyping(): Promise<object> {
        return Promise.resolve({});
    }

    /**
     * Stop typing indicator
     */
    async stopTyping(): Promise<object> {
        return Promise.resolve({});
    }

    /**
     * Check if currently processing a message
     */
    isCurrentlyProcessing(): boolean {
        return this.isProcessing;
    }

    /**
     * Clear the chat history
     */
    clearHistory(): void {
        this.messages.clear();
        this.sessionId = null;
    }
}
