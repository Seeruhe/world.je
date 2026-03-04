<script lang="ts">
    import type { Skill } from "@workadventure/openclaw-client";
    import { skillsStore } from "../../Stores/SkillsStore";
    import { get } from "svelte/store";

    export let skill: Skill;
    export let onInstall: (skill: Skill) => void;
    export let onSelect: (skill: Skill) => void;

    $: installState = skillsStore.getInstallState(skill.id);
    $: isInstalling = installState?.status === "installing" || installState?.status === "uninstalling";

    function getIconComponent(icon: string): string {
        const icons: Record<string, string> = {
            folder: "📁",
            globe: "🌐",
            github: "🤖",
            terminal: "🖥️",
            clipboard: "📋",
            bell: "🔔",
            database: "💾",
            code: "💻",
        };
        return icons[icon] || "⚡";
    }

    function getTypeBadgeColor(type: string): string {
        const colors: Record<string, string> = {
            npm: "bg-red-500/20 text-red-400",
            mcp: "bg-blue-500/20 text-blue-400",
            script: "bg-green-500/20 text-green-400",
            project: "bg-purple-500/20 text-purple-400",
            api: "bg-orange-500/20 text-orange-400",
        };
        return colors[type] || "bg-gray-500/20 text-gray-400";
    }

    function handleInstallClick(e: Event): void {
        e.stopPropagation();
        onInstall(skill);
    }

    function handleCardClick(): void {
        onSelect(skill);
    }
</script>

<div
    class="skill-card p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
    on:click={handleCardClick}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === "Enter" && handleCardClick()}
>
    <div class="flex items-start gap-3">
        <!-- Icon -->
        <div class="skill-icon text-2xl">
            {getIconComponent(skill.icon)}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
                <h4 class="text-white font-medium text-sm truncate">{skill.name}</h4>
                <span class="text-xs px-2 py-0.5 rounded {getTypeBadgeColor(skill.type)}">
                    {skill.type}
                </span>
            </div>
            <p class="text-white/50 text-xs mb-2 line-clamp-2">{skill.description}</p>
            <div class="flex items-center gap-2 text-xs text-white/40">
                <span>v{skill.version}</span>
                <span>•</span>
                <span>{skill.author}</span>
            </div>
        </div>

        <!-- Install button -->
        <div class="skill-action">
            {#if skill.installed}
                <span class="flex items-center gap-1 text-green-400 text-xs">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                    </svg>
                    Installed
                </span>
            {:else if isInstalling}
                <button
                    class="px-3 py-1.5 rounded-lg bg-white/10 text-white/50 text-xs flex items-center gap-1"
                    disabled
                >
                    <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    {installState?.status === "installing" ? "Installing..." : "Uninstalling..."}
                </button>
            {:else}
                <button
                    class="px-3 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-xs transition-colors"
                    on:click={handleInstallClick}
                >
                    Install
                </button>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    .skill-card {
        &:focus {
            outline: 2px solid rgba(147, 51, 234, 0.5);
            outline-offset: 2px;
        }
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
