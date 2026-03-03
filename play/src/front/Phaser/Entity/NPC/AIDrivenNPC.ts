/**
 * AI-driven NPC entity for WorkAdventure
 * Provides interactive AI-powered characters in the virtual world
 */

import { get, writable, readable, type Readable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
import Phaser from "phaser";
import type { GameScene } from "../../Game/GameScene";
import { getOpenClawConnection } from "../../../Chat/Connection/OpenClaw/OpenClawConnection";
import { OpenClawChatRoom } from "../../../Chat/Connection/OpenClaw/OpenClawChatRoom";
import type { AnyKindOfUser } from "../../../Chat/Connection/ChatConnection";
import { SpeechBubble } from "../SpeechBubble";
import { selectedRoomStore } from "../../../Chat/Stores/SelectRoomStore";
import { chatVisibilityStore } from "../../../Stores/ChatStore";
import type { AvailabilityStatus } from "@workadventure/messages";

/**
 * AI NPC configuration from map properties
 */
export interface AINPCConfig {
    id: string;
    name: string;
    x: number;
    y: number;
    personality?: string;
    systemPrompt?: string;
    model?: string;
    triggerDistance?: number;
    triggerMessage?: string;
    greetingMessage?: string;
    texture?: string;
}

/**
 * AI-driven NPC that can hold conversations using OpenClaw
 */
export class AIDrivenNPC extends Phaser.GameObjects.Container {
    private sprite: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;
    private bubble: Phaser.GameObjects.DOMElement | null = null;
    private interactionZone: Phaser.GameObjects.Zone;
    private aiRoom: OpenClawChatRoom | null = null;
    private config: AINPCConfig;
    private isProcessing = false;
    private showBubbleTimeout: NodeJS.Timeout | null = null;
    protected gameScene: GameScene;

    // AI user representation
    private aiUser: AnyKindOfUser;

    constructor(scene: GameScene, config: AINPCConfig) {
        super(scene, config.x, config.y);

        this.gameScene = scene;
        this.config = {
            triggerDistance: 64,
            greetingMessage: "Hello! Would you like to chat?",
            ...config,
        };

        // Create sprite
        this.sprite = scene.add.sprite(0, 0, config.texture || "npc-default");
        this.sprite.setOrigin(0.5, 1);
        this.add(this.sprite);

        // Create name text
        this.nameText = scene.add.text(0, -this.sprite.height - 10, config.name, {
            fontFamily: '"Press Start 2P"',
            fontSize: "8px",
            strokeThickness: 2,
            stroke: "#14304C",
            color: "#ffffff",
        });
        this.nameText.setOrigin(0.5);
        this.add(this.nameText);

        // Create interaction zone
        this.interactionZone = scene.add.zone(
            config.x,
            config.y - this.sprite.height / 2,
            this.config.triggerDistance! * 2,
            this.config.triggerDistance! * 2
        );
        scene.physics.world.enable(this.interactionZone);
        const body = this.interactionZone.body as Phaser.Physics.Arcade.Body;
        body.setImmovable(true);

        // Create AI user representation
        this.aiUser = {
            chatId: `ai-npc-${config.id}`,
            uuid: `ai-npc-${config.id}`,
            availabilityStatus: readable("ONLINE" as unknown as AvailabilityStatus),
            username: config.name,
            pictureStore: readable(undefined),
            roomName: undefined,
            playUri: undefined,
            isAdmin: false,
            isMember: false,
            color: undefined,
            spaceUserId: undefined,
        };

        // Make interactive
        this.setInteractive(
            new Phaser.Geom.Circle(0, -this.sprite.height / 2, 32),
            Phaser.Geom.Circle.Contains
        );

        this.on("pointerdown", this.handleClick, this);
        this.on("pointerover", this.handlePointerOver, this);
        this.on("pointerout", this.handlePointerOut, this);

        scene.add.existing(this);
        this.setDepth(this.y);
    }

    /**
     * Get the AI chat room for this NPC
     */
    getAIChatRoom(currentUser: AnyKindOfUser): OpenClawChatRoom {
        if (!this.aiRoom) {
            const connection = getOpenClawConnection();
            this.aiRoom = connection.createAIChatRoom(
                `ai-npc-room-${this.config.id}`,
                this.config.name,
                currentUser,
                readable(undefined),
                {
                    type: "ai-npc",
                    personality: this.config.personality,
                    systemPrompt: this.config.systemPrompt || this.buildSystemPrompt(),
                    model: this.config.model,
                }
            );
        }
        return this.aiRoom;
    }

    /**
     * Build system prompt from personality
     */
    private buildSystemPrompt(): string {
        const personality = this.config.personality || "a friendly and helpful character";
        return `You are ${this.config.name}, ${personality}. You are an AI-powered NPC in a virtual collaboration space. Keep your responses concise and engaging. Stay in character at all times.`;
    }

    /**
     * Handle click on NPC
     */
    private handleClick(): void {
        const connection = getOpenClawConnection();
        if (!connection.isEnabled() || !connection.isConnected()) {
            this.showBubble("I'm not available right now. Please try again later.");
            return;
        }

        // Get current user info from the scene
        const currentUser = this.getCurrentUser();
        const room = this.getAIChatRoom(currentUser);

        // Show greeting if configured
        if (this.config.greetingMessage && room.messages.length === 0) {
            this.showBubble(this.config.greetingMessage);
        }

        // Open chat
        selectedRoomStore.set(room);
        chatVisibilityStore.set(true);

        // Connect if not already
        if (!connection.isConnected()) {
            connection.connect().catch(console.error);
        }
    }

    /**
     * Get current user from scene
     */
    private getCurrentUser(): AnyKindOfUser {
        // Get the current player's info from the game scene
        const currentPlayer = this.gameScene.CurrentPlayer;
        return {
            chatId: `user-${uuidv4()}`,
            uuid: uuidv4(),
            availabilityStatus: readable("ONLINE" as unknown as AvailabilityStatus),
            username: currentPlayer?.playerName || "Player",
            pictureStore: currentPlayer?.pictureStore || readable(undefined),
            roomName: undefined,
            playUri: undefined,
            isAdmin: false,
            isMember: false,
            color: undefined,
            spaceUserId: undefined,
        };
    }

    /**
     * Handle pointer over
     */
    private handlePointerOver(): void {
        this.sprite.setTint(0xcccccc);
        if (this.config.triggerMessage) {
            this.showBubble(this.config.triggerMessage, 3000);
        }
    }

    /**
     * Handle pointer out
     */
    private handlePointerOut(): void {
        this.sprite.clearTint();
        this.hideBubble();
    }

    /**
     * Show a speech bubble
     */
    showBubble(text: string, duration?: number): void {
        // Clear existing bubble
        this.hideBubble();

        // Create new bubble
        const bubble = new SpeechBubble(text);
        const element = bubble.getElement();
        this.bubble = this.gameScene.add.dom(
            0,
            -this.sprite.height - 40
        ).createFromHTML(element.outerHTML);
        if (this.bubble) {
            this.add(this.bubble);
        }

        // Auto-hide after duration
        if (duration) {
            this.showBubbleTimeout = setTimeout(() => {
                this.hideBubble();
            }, duration);
        }
    }

    /**
     * Hide the speech bubble
     */
    hideBubble(): void {
        if (this.showBubbleTimeout) {
            clearTimeout(this.showBubbleTimeout);
            this.showBubbleTimeout = null;
        }
        if (this.bubble) {
            this.bubble.destroy();
            this.bubble = null;
        }
    }

    /**
     * Check if player is in trigger distance
     */
    isPlayerInRange(playerX: number, playerY: number): boolean {
        const distance = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            playerX,
            playerY
        );
        return distance <= (this.config.triggerDistance || 64);
    }

    /**
     * Update method called each frame
     */
    update(playerX: number, playerY: number): void {
        // Update depth based on Y position
        this.setDepth(this.y);

        // Check if player is in range
        if (this.isPlayerInRange(playerX, playerY)) {
            // Could add proximity-based behaviors here
        }
    }

    /**
     * Clean up
     */
    destroy(): void {
        this.hideBubble();
        this.interactionZone.destroy();
        this.sprite.destroy();
        this.nameText.destroy();
        super.destroy();
    }
}

/**
 * Factory function to create AI NPCs
 */
export function createAINPC(scene: GameScene, config: AINPCConfig): AIDrivenNPC {
    return new AIDrivenNPC(scene, config);
}
