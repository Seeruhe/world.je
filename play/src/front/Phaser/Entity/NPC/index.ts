/**
 * NPC module exports
 */

export { AIDrivenNPC, createAINPC, type AINPCConfig } from "./AIDrivenNPC";
export { SkillsNPC, createSkillsNPC, isSkillsNPC, type SkillsNPCConfig, type SkillsNPCClickCallback } from "./SkillsNPC";
export { ServerRoomNPC, createServerRoomNPC, isServerRoomNPC, type ServerRoomNPCConfig, type ServerRoomNPCClickCallback } from "./ServerRoomNPC";
export { NPCManager, createNPCManager, type AnyNPC, type SkillsNPCClickCallback as NPCManagerSkillsNPCClickCallback } from "./NPCManager";
