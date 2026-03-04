/**
 * NPC Manager - Manages AI-driven NPCs in the game scene
 * Handles creation, updates, and cleanup of AI NPCs
 */

import type { GameScene } from "../../Game/GameScene";
import { AIDrivenNPC, type AINPCConfig, createAINPC } from "./AIDrivenNPC";
import { SkillsNPC, type SkillsNPCConfig, createSkillsNPC, isSkillsNPC } from "./SkillsNPC";
import { ServerRoomNPC, type ServerRoomNPCConfig, createServerRoomNPC, isServerRoomNPC } from "./ServerRoomNPC";
import { AITriggerArea, type AITriggerZoneConfig, createAITriggerArea } from "../../Game/Areas/AITriggerArea";
import { OPENCLAW_ENABLED } from "../../../Enum/EnvironmentVariable";
import type { ITiledMapProperty } from "@workadventure/tiled-map-type-guard";

/**
 * Map object property names for AI NPCs and zones
 */
const AI_NPC_LAYER_NAME = "ai-npcs";
const AI_ZONE_LAYER_NAME = "ai-zones";
const SKILLS_NPC_LAYER_NAME = "skills-npcs";
const SERVER_ROOM_NPC_LAYER_NAME = "server-room-npcs";

/**
 * Union type for all NPC types
 */
export type AnyNPC = AIDrivenNPC | SkillsNPC | ServerRoomNPC;

/**
 * Callback type for Skills NPC click events
 */
export type SkillsNPCClickCallback = (npc: SkillsNPC) => void;

/**
 * Callback type for Server Room NPC click events
 */
export type ServerRoomNPCClickCallback = (npc: ServerRoomNPC) => void;

/**
 * NPC Manager handles all AI-driven NPCs and trigger zones in a scene
 */
export class NPCManager {
    private scene: GameScene;
    private npcs: Map<string, AIDrivenNPC> = new Map();
    private skillsNpcs: Map<string, SkillsNPC> = new Map();
    private serverRoomNpcs: Map<string, ServerRoomNPC> = new Map();
    private triggerAreas: Map<string, AITriggerArea> = new Map();
    private onSkillsNPCClick: SkillsNPCClickCallback | null = null;
    private onServerRoomNPCClick: ServerRoomNPCClickCallback | null = null;

    constructor(scene: GameScene) {
        this.scene = scene;
    }

    /**
     * Set callback for Skills NPC click events
     */
    public setOnSkillsNPCClick(callback: SkillsNPCClickCallback): void {
        this.onSkillsNPCClick = callback;

        // Update existing Skills NPCs with the callback
        for (const npc of this.skillsNpcs.values()) {
            npc.setOnClick(callback);
        }
    }

    /**
     * Set callback for Server Room NPC click events
     */
    public setOnServerRoomNPCClick(callback: ServerRoomNPCClickCallback): void {
        this.onServerRoomNPCClick = callback;

        // Update existing Server Room NPCs with the callback
        for (const npc of this.serverRoomNpcs.values()) {
            npc.setOnClick(callback);
        }
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

        // Load Skills NPCs from map
        this.loadSkillsNPCsFromMap();

        // Load Server Room NPCs from map
        this.loadServerRoomNPCsFromMap();

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
     * Load Skills NPCs from map layer
     */
    private loadSkillsNPCsFromMap(): void {
        const map = this.scene.Map;
        if (!map) {
            console.warn("No map available to load Skills NPCs");
            return;
        }

        // Look for Skills NPC objects in the map
        const skillsNpcsLayer = map.getObjectLayer(SKILLS_NPC_LAYER_NAME);
        if (!skillsNpcsLayer) {
            console.log("No Skills NPCs layer found in map");
            return;
        }

        for (const object of skillsNpcsLayer.objects) {
            const config = this.parseSkillsNPCConfig(object);
            if (config) {
                this.addSkillsNPC(config);
            }
        }

        console.log(`Loaded ${this.skillsNpcs.size} Skills NPCs from map`);
    }

    /**
     * Load Server Room NPCs from map layer
     */
    private loadServerRoomNPCsFromMap(): void {
        const map = this.scene.Map;
        if (!map) {
            console.warn("No map available to load Server Room NPCs");
            return;
        }

        // Look for Server Room NPC objects in the map
        const serverRoomNpcsLayer = map.getObjectLayer(SERVER_ROOM_NPC_LAYER_NAME);
        if (!serverRoomNpcsLayer) {
            console.log("No Server Room NPCs layer found in map");
            return;
        }

        for (const object of serverRoomNpcsLayer.objects) {
            const config = this.parseServerRoomNPCConfig(object);
            if (config) {
                this.addServerRoomNPC(config);
            }
        }

        console.log(`Loaded ${this.serverRoomNpcs.size} Server Room NPCs from map`);
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
     * Parse Skills NPC configuration from Tiled object
     */
    private parseSkillsNPCConfig(object: Phaser.Types.Tilemaps.TiledObject): SkillsNPCConfig | null {
        if (!object.x || !object.y) {
            return null;
        }

        const properties = this.parseProperties(object.properties);

        return {
            id: object.id.toString() || `skills-npc-${Date.now()}`,
            name: object.name || "Skills Store",
            x: object.x,
            y: object.y,
            texture: properties.texture || properties["texture"] || "npc-tech-assistant",
            triggerDistance: parseInt(properties.triggerDistance || properties["triggerDistance"] || "64", 10),
            triggerMessage: properties.triggerMessage || properties["triggerMessage"] || properties.trigger_message || "Click to open Skills Store",
            greetingMessage: properties.greeting || properties["greeting"] || properties.greetingMessage || "Welcome to the Skills Store!",
            personality: properties.personality || properties["personality"] || "a helpful skills management assistant",
            associatedDevice: properties.associatedDevice || properties["associatedDevice"] || properties.associated_device,
        };
    }

    /**
     * Parse Server Room NPC configuration from Tiled object
     */
    private parseServerRoomNPCConfig(object: Phaser.Types.Tilemaps.TiledObject): ServerRoomNPCConfig | null {
        if (!object.x || !object.y) {
            return null;
        }

        const properties = this.parseProperties(object.properties);

        return {
            id: object.id.toString() || `server-room-npc-${Date.now()}`,
            name: object.name || "Server Room",
            x: object.x,
            y: object.y,
            texture: properties.texture || properties["texture"] || "npc-server-admin",
            triggerDistance: parseInt(properties.triggerDistance || properties["triggerDistance"] || "64", 10),
            triggerMessage: properties.triggerMessage || properties["triggerMessage"] || properties.trigger_message || "Click to open Server Configuration",
            greetingMessage: properties.greeting || properties["greeting"] || properties.greetingMessage || "Configure your system settings here.",
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
     * Add a Skills NPC to the scene
     */
    public addSkillsNPC(config: SkillsNPCConfig): SkillsNPC {
        const npc = createSkillsNPC(this.scene, config);

        // Set click callback if available
        if (this.onSkillsNPCClick) {
            npc.setOnClick(this.onSkillsNPCClick);
        }

        this.skillsNpcs.set(config.id, npc);
        return npc;
    }

    /**
     * Add a Server Room NPC to the scene
     */
    public addServerRoomNPC(config: ServerRoomNPCConfig): ServerRoomNPC {
        const npc = createServerRoomNPC(this.scene, config);

        // Set click callback if available
        if (this.onServerRoomNPCClick) {
            npc.setOnClick(this.onServerRoomNPCClick);
        }

        this.serverRoomNpcs.set(config.id, npc);
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

        // Also check Skills NPCs
        const skillsNpc = this.skillsNpcs.get(id);
        if (skillsNpc) {
            skillsNpc.destroy();
            this.skillsNpcs.delete(id);
        }

        // Also check Server Room NPCs
        const serverRoomNpc = this.serverRoomNpcs.get(id);
        if (serverRoomNpc) {
            serverRoomNpc.destroy();
            this.serverRoomNpcs.delete(id);
        }
    }

    /**
     * Remove a Skills NPC from the scene
     */
    public removeSkillsNPC(id: string): void {
        const npc = this.skillsNpcs.get(id);
        if (npc) {
            npc.destroy();
            this.skillsNpcs.delete(id);
        }
    }

    /**
     * Get an AI NPC by ID
     */
    public getNPC(id: string): AIDrivenNPC | undefined {
        return this.npcs.get(id);
    }

    /**
     * Get a Skills NPC by ID
     */
    public getSkillsNPC(id: string): SkillsNPC | undefined {
        return this.skillsNpcs.get(id);
    }

    /**
     * Get any NPC by ID (checks both AI NPCs and Skills NPCs)
     */
    public getAnyNPC(id: string): AnyNPC | undefined {
        return this.npcs.get(id) || this.skillsNpcs.get(id) || this.serverRoomNpcs.get(id);
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

        // Update all AI NPCs
        for (const npc of this.npcs.values()) {
            npc.update(playerX, playerY);
        }

        // Update all Skills NPCs
        for (const npc of this.skillsNpcs.values()) {
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
     * Get all AI NPCs
     */
    public getAllNPCs(): AIDrivenNPC[] {
        return Array.from(this.npcs.values());
    }

    /**
     * Get all Skills NPCs
     */
    public getAllSkillsNPCs(): SkillsNPC[] {
        return Array.from(this.skillsNpcs.values());
    }

    /**
     * Get all NPCs (both AI and Skills NPCs)
     */
    public getAllAnyNPCs(): AnyNPC[] {
        return [...this.npcs.values(), ...this.skillsNpcs.values()];
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
        // Destroy all AI NPCs
        for (const npc of this.npcs.values()) {
            npc.destroy();
        }
        this.npcs.clear();

        // Destroy all Skills NPCs
        for (const npc of this.skillsNpcs.values()) {
            npc.destroy();
        }
        this.skillsNpcs.clear();

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
