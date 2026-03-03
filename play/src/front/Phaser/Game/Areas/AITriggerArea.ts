/**
 * AI Trigger Area - Region-based AI interaction trigger
 * Automatically opens AI chat when player enters the area
 */

import { readable } from "svelte/store";
import { v4 as uuidv4 } from "uuid";
import type { GameScene } from "../GameScene";
import { getOpenClawConnection } from "../../../Chat/Connection/OpenClaw/OpenClawConnection";
import { OpenClawChatRoom } from "../../../Chat/Connection/OpenClaw/OpenClawChatRoom";
import type { AnyKindOfUser } from "../../../Chat/Connection/ChatConnection";
import { selectedRoomStore } from "../../../Chat/Stores/SelectRoomStore";
import { chatVisibilityStore } from "../../../Stores/ChatStore";
import { OPENCLAW_ENABLED } from "../../../Enum/EnvironmentVariable";
import type { AvailabilityStatus } from "@workadventure/messages";

/**
 * AI Trigger Zone configuration from map properties
 */
export interface AITriggerZoneConfig {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    systemPrompt?: string;
    greeting?: string;
    autoOpen?: boolean;
    model?: string;
    triggerOnce?: boolean;
    cooldownMs?: number;
}

/**
 * AI Trigger Area that opens AI chat when player enters
 */
export class AITriggerArea extends Phaser.GameObjects.Rectangle {
    private config: AITriggerZoneConfig;
    protected gameScene: GameScene;
    private aiRoom: OpenClawChatRoom | null = null;
    private hasTriggered = false;
    private lastTriggerTime = 0;
    private aiUser: AnyKindOfUser;
    private overlapCollider: Phaser.Physics.Arcade.Collider | null = null;
    private isPlayerInside = false;

    constructor(scene: GameScene, config: AITriggerZoneConfig) {
        super(
            scene,
            config.x + config.width / 2,
            config.y + config.height / 2,
            config.width,
            config.height,
            0x667eea,
            0.1
        );

        this.gameScene = scene;
        this.config = {
            autoOpen: true,
            triggerOnce: false,
            cooldownMs: 30000, // 30 seconds default cooldown
            greeting: "Welcome! Feel free to ask me anything.",
            ...config,
        };

        // Create AI user representation
        this.aiUser = {
            chatId: `ai-zone-${config.id}`,
            uuid: `ai-zone-${config.id}`,
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

        // Add to scene
        scene.add.existing(this);
        scene.physics.add.existing(this, true);

        // Make visible only in debug mode
        this.setVisible(false);

        // Set up overlap detection with player
        this.setupOverlapDetection();
    }

    /**
     * Set up overlap detection with the current player
     */
    private setupOverlapDetection(): void {
        const currentPlayer = this.gameScene.CurrentPlayer;
        if (!currentPlayer) {
            // Retry after a short delay if player isn't ready
            setTimeout(() => this.setupOverlapDetection(), 100);
            return;
        }

        this.overlapCollider = this.gameScene.physics.add.overlap(
            currentPlayer,
            this as Phaser.GameObjects.GameObject,
            this.onPlayerEnter.bind(this) as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
            undefined,
            this
        );
    }

    /**
     * Called when player enters the area
     */
    private onPlayerEnter(
        _player: Phaser.GameObjects.GameObject,
        _zone: Phaser.GameObjects.GameObject
    ): void {
        if (!OPENCLAW_ENABLED) {
            return;
        }

        const now = Date.now();

        // Check if already triggered and triggerOnce is set
        if (this.config.triggerOnce && this.hasTriggered) {
            return;
        }

        // Check cooldown
        if (this.config.cooldownMs && now - this.lastTriggerTime < this.config.cooldownMs) {
            return;
        }

        // Prevent multiple triggers while inside
        if (this.isPlayerInside) {
            return;
        }

        this.isPlayerInside = true;
        this.lastTriggerTime = now;
        this.hasTriggered = true;

        this.triggerAI();
    }

    /**
     * Called when player exits the area
     */
    public onPlayerExit(): void {
        this.isPlayerInside = false;
    }

    /**
     * Trigger the AI interaction
     */
    private triggerAI(): void {
        const connection = getOpenClawConnection();
        if (!connection.isEnabled() || !connection.isConnected()) {
            console.log("OpenClaw not available for AI zone trigger");
            return;
        }

        // Get or create AI chat room
        const room = this.getAIChatRoom();

        // Add greeting message if configured and room is empty
        if (this.config.greeting && room.messages.length === 0) {
            // The greeting will be shown as the AI's first message when user opens chat
        }

        // Open chat if autoOpen is enabled
        if (this.config.autoOpen) {
            selectedRoomStore.set(room);
            chatVisibilityStore.set(true);
        }
    }

    /**
     * Get the AI chat room for this zone
     */
    getAIChatRoom(): OpenClawChatRoom {
        if (!this.aiRoom) {
            const connection = getOpenClawConnection();
            const currentUser = this.getCurrentUser();
            this.aiRoom = connection.createAIChatRoom(
                `ai-zone-room-${this.config.id}`,
                this.config.name,
                currentUser,
                readable(undefined),
                {
                    type: "ai-assistant",
                    systemPrompt: this.config.systemPrompt || this.buildDefaultSystemPrompt(),
                    model: this.config.model,
                }
            );
        }
        return this.aiRoom;
    }

    /**
     * Build default system prompt
     */
    private buildDefaultSystemPrompt(): string {
        return `You are an AI assistant in a virtual collaboration space, specifically in the "${this.config.name}" area. Be helpful, friendly, and provide concise responses. You can help users with questions about the area, general assistance, or just have a friendly conversation.`;
    }

    /**
     * Get current user from scene
     */
    private getCurrentUser(): AnyKindOfUser {
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
     * Show the area (for debugging)
     */
    public show(): void {
        this.setVisible(true);
    }

    /**
     * Hide the area
     */
    public hide(): void {
        this.setVisible(false);
    }

    /**
     * Get the zone config
     */
    public getConfig(): AITriggerZoneConfig {
        return this.config;
    }

    /**
     * Check if player is currently inside
     */
    public isInside(): boolean {
        return this.isPlayerInside;
    }

    /**
     * Reset the trigger state
     */
    public reset(): void {
        this.hasTriggered = false;
        this.isPlayerInside = false;
    }

    /**
     * Clean up
     */
    destroy(): void {
        if (this.overlapCollider) {
            this.overlapCollider.destroy();
            this.overlapCollider = null;
        }
        super.destroy();
    }
}

/**
 * Factory function to create AI trigger area
 */
export function createAITriggerArea(scene: GameScene, config: AITriggerZoneConfig): AITriggerArea {
    return new AITriggerArea(scene, config);
}
