/**
 * NPC Manager - Manages AI-driven NPCs in the game scene
 * Handles creation, updates, and cleanup of AI NPCs
 */

import type { GameScene } from "../../Game/GameScene";
import { AIDrivenNPC, type AINPCConfig, createAINPC } from "./AIDrivenNPC";
import { AITriggerArea, type AITriggerZoneConfig, createAITriggerArea } from "../../Game/Areas/AITriggerArea";
import { OPENCLAW_ENABLED } from "../../../Enum/EnvironmentVariable";
import type { ITiledMapProperty } from "@workadventure/tiled-map-type-guard";

/**
 * Map object property names for AI NPCs and zones
 */
const AI_NPC_LAYER_NAME = "ai-npcs";
const AI_ZONE_LAYER_NAME = "ai-zones";

/**
 * NPC Manager handles all AI-driven NPCs and trigger zones in a scene
 */
export class NPCManager {
    private scene: GameScene;
    private npcs: Map<string, AIDrivenNPC> = new Map();
    private triggerAreas: Map<string, AITriggerArea> = new Map();

    constructor(scene: GameScene) {
        this.scene = scene;
    }

    /**
     * Initialize NPCs and zones from map data
     */
    public initializeFromMap(): void {
        if (!OPENCLAW_ENABLED) {
            console.log("OpenClaw is not enabled, skipping AI NPCs and zones initialization");
            return;
        }

        // Load AI NPCs from map
        this.loadNPCsFromMap();

        // Load AI trigger zones from map
        this.loadZonesFromMap();
    }

    /**
     * Load AI NPCs from map layer
     */
    private loadNPCsFromMap(): void {
        const map = this.scene.Map;
        if (!map) {
            console.warn("No map available to load AI NPCs");
            return;
        }

        // Look for AI NPC objects in the map
        const npcsLayer = map.getObjectLayer(AI_NPC_LAYER_NAME);
        if (!npcsLayer) {
            console.log("No AI NPCs layer found in map");
            return;
        }

        for (const object of npcsLayer.objects) {
            const config = this.parseNPCConfig(object);
            if (config) {
                this.addNPC(config);
            }
        }

        console.log(`Loaded ${this.npcs.size} AI NPCs from map`);
    }

    /**
     * Load AI trigger zones from map layer
     */
    private loadZonesFromMap(): void {
        const map = this.scene.Map;
        if (!map) {
            console.warn("No map available to load AI zones");
            return;
        }

        // Look for AI zone objects in the map
        const zonesLayer = map.getObjectLayer(AI_ZONE_LAYER_NAME);
        if (!zonesLayer) {
            console.log("No AI zones layer found in map");
            return;
        }

        for (const object of zonesLayer.objects) {
            const config = this.parseZoneConfig(object);
            if (config) {
                this.addTriggerArea(config);
            }
        }

        console.log(`Loaded ${this.triggerAreas.size} AI trigger zones from map`);
    }

    /**
     * Parse NPC configuration from Tiled object
     */
    private parseNPCConfig(object: Phaser.Types.Tilemaps.TiledObject): AINPCConfig | null {
        if (!object.x || !object.y) {
            return null;
        }

        const properties = this.parseProperties(object.properties);

        return {
            id: object.id.toString() || `npc-${Date.now()}`,
            name: object.name || "AI Assistant",
            x: object.x,
            y: object.y,
            personality: properties.personality || properties["personality"],
            systemPrompt: properties.systemPrompt || properties["systemPrompt"] || properties.system_prompt,
            model: properties.model || properties["model"],
            triggerDistance: parseInt(properties.triggerDistance || properties["triggerDistance"] || "64", 10),
            triggerMessage: properties.triggerMessage || properties["triggerMessage"] || properties.trigger_message,
            greetingMessage: properties.greeting || properties["greeting"] || properties.greetingMessage,
            texture: properties.texture || properties["texture"] || "npc-default",
        };
    }

    /**
     * Parse zone configuration from Tiled object
     */
    private parseZoneConfig(object: Phaser.Types.Tilemaps.TiledObject): AITriggerZoneConfig | null {
        if (!object.x || !object.y || !object.width || !object.height) {
            return null;
        }

        const properties = this.parseProperties(object.properties);

        return {
            id: object.id.toString() || `zone-${Date.now()}`,
            name: object.name || "AI Zone",
            x: object.x,
            y: object.y,
            width: object.width,
            height: object.height,
            systemPrompt: properties.systemPrompt || properties["systemPrompt"] || properties.system_prompt,
            greeting: properties.greeting || properties["greeting"],
            autoOpen: (properties.autoOpen || properties["autoOpen"] || properties.auto_open) !== "false",
            model: properties.model || properties["model"],
            triggerOnce: (properties.triggerOnce || properties["triggerOnce"] || properties.trigger_once) === "true",
            cooldownMs: parseInt(properties.cooldownMs || properties["cooldownMs"] || properties.cooldown_ms || "30000", 10),
        };
    }

    /**
     * Parse Tiled properties array into an object
     */
    private parseProperties(
        properties?: ITiledMapProperty[] | Record<string, unknown>
    ): Record<string, string> {
        const result: Record<string, string> = {};

        if (!properties) {
            return result;
        }

        // Handle array format (from Tiled)
        if (Array.isArray(properties)) {
            for (const prop of properties) {
                if (prop.name && prop.value !== undefined) {
                    result[prop.name] = String(prop.value);
                }
            }
        } else {
            // Handle object format
            for (const [key, value] of Object.entries(properties)) {
                result[key] = String(value);
            }
        }

        return result;
    }

    /**
     * Add an AI NPC to the scene
     */
    public addNPC(config: AINPCConfig): AIDrivenNPC {
        const npc = createAINPC(this.scene, config);
        this.npcs.set(config.id, npc);
        return npc;
    }

    /**
     * Remove an AI NPC from the scene
     */
    public removeNPC(id: string): void {
        const npc = this.npcs.get(id);
        if (npc) {
            npc.destroy();
            this.npcs.delete(id);
        }
    }

    /**
     * Get an AI NPC by ID
     */
    public getNPC(id: string): AIDrivenNPC | undefined {
        return this.npcs.get(id);
    }

    /**
     * Add an AI trigger area to the scene
     */
    public addTriggerArea(config: AITriggerZoneConfig): AITriggerArea {
        const area = createAITriggerArea(this.scene, config);
        this.triggerAreas.set(config.id, area);
        return area;
    }

    /**
     * Remove an AI trigger area from the scene
     */
    public removeTriggerArea(id: string): void {
        const area = this.triggerAreas.get(id);
        if (area) {
            area.destroy();
            this.triggerAreas.delete(id);
        }
    }

    /**
     * Get an AI trigger area by ID
     */
    public getTriggerArea(id: string): AITriggerArea | undefined {
        return this.triggerAreas.get(id);
    }

    /**
     * Update all NPCs (called each frame)
     */
    public update(): void {
        const currentPlayer = this.scene.CurrentPlayer;
        if (!currentPlayer) {
            return;
        }

        const playerX = currentPlayer.x;
        const playerY = currentPlayer.y;

        // Update all NPCs
        for (const npc of this.npcs.values()) {
            npc.update(playerX, playerY);
        }

        // Check trigger areas for player exit
        for (const area of this.triggerAreas.values()) {
            const bounds = area.getBounds();
            const isInside = bounds.contains(playerX, playerY);

            if (!isInside && area.isInside()) {
                area.onPlayerExit();
            }
        }
    }

    /**
     * Get all NPCs
     */
    public getAllNPCs(): AIDrivenNPC[] {
        return Array.from(this.npcs.values());
    }

    /**
     * Get all trigger areas
     */
    public getAllTriggerAreas(): AITriggerArea[] {
        return Array.from(this.triggerAreas.values());
    }

    /**
     * Show all trigger areas (for debugging)
     */
    public showTriggerAreas(): void {
        for (const area of this.triggerAreas.values()) {
            area.show();
        }
    }

    /**
     * Hide all trigger areas
     */
    public hideTriggerAreas(): void {
        for (const area of this.triggerAreas.values()) {
            area.hide();
        }
    }

    /**
     * Clean up all NPCs and trigger areas
     */
    public destroy(): void {
        // Destroy all NPCs
        for (const npc of this.npcs.values()) {
            npc.destroy();
        }
        this.npcs.clear();

        // Destroy all trigger areas
        for (const area of this.triggerAreas.values()) {
            area.destroy();
        }
        this.triggerAreas.clear();
    }
}

/**
 * Factory function to create NPC manager
 */
export function createNPCManager(scene: GameScene): NPCManager {
    return new NPCManager(scene);
}
