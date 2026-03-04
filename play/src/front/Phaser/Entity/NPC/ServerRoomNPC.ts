/**
 * Server Room NPC - An NPC that opens the Server Room configuration panel
 * This NPC serves as a gateway to system configuration in the virtual world
 */

import { readable, type Readable } from "svelte/store";
import Phaser from "phaser";
import type { GameScene } from "../../Game/GameScene";
import type { AnyKindOfUser } from "../../../Chat/Connection/ChatConnection";
import { SpeechBubble } from "../SpeechBubble";
import type { AvailabilityStatus } from "@workadventure/messages";

/**
 * Server Room NPC configuration from map properties
 */
export interface ServerRoomNPCConfig {
    id: string;
    name: string;
    x: number;
    y: number;
    texture?: string;
    triggerDistance?: number;
    triggerMessage?: string;
    greetingMessage?: string;
}

/**
 * Event callback types
 */
export type ServerRoomNPCClickCallback = (npc: ServerRoomNPC) => void;

/**
 * Server Room NPC that opens the configuration panel
 */
export class ServerRoomNPC extends Phaser.GameObjects.Container {
    private sprite: Phaser.GameObjects.Sprite;
    private nameText: Phaser.GameObjects.Text;
    private bubble: Phaser.GameObjects.DOMElement | null = null;
    private interactionZone: Phaser.GameObjects.Zone;
    private config: ServerRoomNPCConfig;
    private showBubbleTimeout: NodeJS.Timeout | null = null;
    protected gameScene: GameScene;

    // Callback for when NPC is clicked
    private onClickCallback: ServerRoomNPCClickCallback | null = null;

    // AI user representation (for compatibility)
    private aiUser: AnyKindOfUser;

    constructor(scene: GameScene, config: ServerRoomNPCConfig) {
        super(scene, config.x, config.y);

        this.gameScene = scene;
        this.config = {
            triggerDistance: 64,
            greetingMessage: "Welcome to the Server Room. Configure your AI providers and system settings here.",
            triggerMessage: "Click to open Server Configuration",
            texture: "npc-server-admin",
            ...config,
        };

        // Create sprite
        this.sprite = scene.add.sprite(0, 0, this.config.texture || "npc-default");
        this.sprite.setOrigin(0.5, 1);
        this.add(this.sprite);

        // Create name text with special styling for Server Room NPC
        this.nameText = scene.add.text(0, -this.sprite.height - 10, config.name, {
            fontFamily: '"Press Start 2P"',
            fontSize: "8px",
            strokeThickness: 2,
            stroke: "#14304C",
            color: "#22c55e", // Green color for Server Room NPC
        });
        this.nameText.setOrigin(0.5);
        this.add(this.nameText);

        // Add a server icon badge
        const badge = scene.add.text(this.sprite.width / 3, -this.sprite.height + 10, "🖥️", {
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
            chatId: `server-room-npc-${config.id}`,
            uuid: `server-room-npc-${config.id}`,
            availabilityStatus: readable("ONLINE" as unknown as AvailabilityStatus),
            username: config.name,
            pictureStore: readable(undefined),
            roomName: undefined,
            playUri: undefined,
            isAdmin: true, // Server room NPCs are considered admins
            isMember: true,
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
    setOnClick(callback: ServerRoomNPCClickCallback): void {
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
     * Handle click on NPC - Opens Server Room Panel
     */
    private handleClick(): void {
        // Show greeting
        if (this.config.greetingMessage) {
            this.showBubble(this.config.greetingMessage, 3000);
        }

        // Call the callback to open Server Room Panel
        if (this.onClickCallback) {
            this.onClickCallback(this);
        }
    }

    /**
     * Handle pointer over
     */
    private handlePointerOver(): void {
        this.sprite.setTint(0x90ee90); // Light green tint
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
 * Factory function to create Server Room NPCs
 */
export function createServerRoomNPC(scene: GameScene, config: ServerRoomNPCConfig): ServerRoomNPC {
    return new ServerRoomNPC(scene, config);
}

/**
 * Type guard to check if an object is a ServerRoomNPC
 */
export function isServerRoomNPC(obj: unknown): obj is ServerRoomNPC {
    return obj instanceof ServerRoomNPC;
}
