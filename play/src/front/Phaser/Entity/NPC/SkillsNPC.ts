/**
 * Skills NPC - An AI-driven NPC that opens the Skills Panel when clicked
 * This NPC serves as a gateway to the Skills Store in the virtual world
 */

import { readable, type Readable } from "svelte/store";
import Phaser from "phaser";
import type { GameScene } from "../../Game/GameScene";
import type { AnyKindOfUser } from "../../../Chat/Connection/ChatConnection";
import { SpeechBubble } from "../SpeechBubble";
import type { AvailabilityStatus } from "@workadventure/messages";

/**
 * Skills NPC configuration from map properties
 */
export interface SkillsNPCConfig {
    id: string;
    name: string;
    x: number;
    y: number;
    texture?: string;
    triggerDistance?: number;
    triggerMessage?: string;
    greetingMessage?: string;
    personality?: string;
    associatedDevice?: string;
}

/**
 * Event callback types
 */
export type SkillsNPCClickCallback = (npc: SkillsNPC) => void;

/**
 * Skills NPC that opens the Skills Panel instead of a chat room
 */
export class SkillsNPC extends Phaser.GameObjects.Container {
    private sprite: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;
    private bubble: Phaser.GameObjects.DOMElement | null = null;
    private interactionZone: Phaser.GameObjects.Zone;
    private config: SkillsNPCConfig;
    private showBubbleTimeout: NodeJS.Timeout | null = null;
    protected gameScene: GameScene;

    // Callback for when NPC is clicked
    private onClickCallback: SkillsNPCClickCallback | null = null;

    // AI user representation (for compatibility with AIDrivenNPC pattern)
    private aiUser: AnyKindOfUser;

    constructor(scene: GameScene, config: SkillsNPCConfig) {
        super(scene, config.x, config.y);

        this.gameScene = scene;
        this.config = {
            triggerDistance: 64,
            greetingMessage: "Welcome to the Skills Store! I can help you manage and install skills.",
            triggerMessage: "Click to open Skills Store",
            texture: "npc-tech-assistant",
            ...config,
        };

        // Create sprite
        this.sprite = scene.add.sprite(0, 0, this.config.texture || "npc-default");
        this.sprite.setOrigin(0.5, 1);
        this.add(this.sprite);

        // Create name text with special styling for Skills NPC
        this.nameText = scene.add.text(0, -this.sprite.height - 10, config.name, {
            fontFamily: '"Press Start 2P"',
            fontSize: "8px",
            strokeThickness: 2,
            stroke: "#14304C",
            color: "#a855f7", // Purple color for Skills NPC
        });
        this.nameText.setOrigin(0.5);
        this.add(this.nameText);

        // Add a small icon badge to indicate it's a Skills NPC
        const badge = scene.add.text(this.sprite.width / 3, -this.sprite.height + 10, "⚡", {
            fontSize: "10px",
        });
        this.add(badge);

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
            chatId: `skills-npc-${config.id}`,
            uuid: `skills-npc-${config.id}`,
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
     * Set the click callback
     */
    setOnClick(callback: SkillsNPCClickCallback): void {
        this.onClickCallback = callback;
    }

    /**
     * Get the AI user representation
     */
    getAIUser(): AnyKindOfUser {
        return this.aiUser;
    }

    /**
     * Get NPC ID
     */
    getId(): string {
        return this.config.id;
    }

    /**
     * Get NPC name
     */
    getName(): string {
        return this.config.name;
    }

    /**
     * Get associated device ID if any
     */
    getAssociatedDevice(): string | undefined {
        return this.config.associatedDevice;
    }

    /**
     * Handle click on NPC - Opens Skills Panel
     */
    private handleClick(): void {
        // Show greeting
        if (this.config.greetingMessage) {
            this.showBubble(this.config.greetingMessage, 3000);
        }

        // Call the callback to open Skills Panel
        if (this.onClickCallback) {
            this.onClickCallback(this);
        }
    }

    /**
     * Handle pointer over
     */
    private handlePointerOver(): void {
        this.sprite.setTint(0xdda0dd); // Light purple tint
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

        // Could add proximity-based behaviors here
        // For example, animate the NPC when player is nearby
        if (this.isPlayerInRange(playerX, playerY)) {
            // Add subtle animation or glow effect
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
 * Factory function to create Skills NPCs
 */
export function createSkillsNPC(scene: GameScene, config: SkillsNPCConfig): SkillsNPC {
    return new SkillsNPC(scene, config);
}

/**
 * Type guard to check if an object is a SkillsNPC
 */
export function isSkillsNPC(obj: unknown): obj is SkillsNPC {
    return obj instanceof SkillsNPC;
}
