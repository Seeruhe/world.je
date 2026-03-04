<script lang="ts">
    import type { Skill, SkillTarget } from "@workadventure/openclaw-client";
    import { skillsStore } from "../../Stores/SkillsStore";
    import { targetsStore } from "../../Stores/TargetsStore";
    import { get } from "svelte/store";
    import { onMount } from "svelte";

    export let skill: Skill;
    export let onClose: () => void;
    export let onInstall: (skill: Skill) => void;
    export let onUninstall: (skill: Skill) => void;
    export let onExecute: (skill: Skill, targetId?: string, parameters?: Record<string, unknown>) => void;

    let selectedTargetId: string | undefined = undefined;
    let executionMode: "server" | "agent" = "server";
    let parameters: Record<string, unknown> = {};
    let showConfig = false;

    $: installState = skillsStore.getInstallState(skill.id);
    $: targets = get(targetsStore).targets;
    $: boundTargets = targets.filter((t) => t.boundSkills?.includes(skill.id));
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

    function getPermissionIcon(type: string): string {
        const icons: Record<string, string> = {
            "file-system": "📁",
            network: "🌐",
            shell: "💻",
            device: "🖥️",
            mcp: "🔗",
            api: "🔌",
        };
        return icons[type] || "⚠️";
    }

    function handleInstallClick(): void {
        onInstall(skill);
    }

    function handleUninstallClick(): void {
        onUninstall(skill);
    }

    function handleExecuteClick(): void {
        onExecute(skill, selectedTargetId, parameters);
    }

    function handleConfigChange(key: string, value: unknown): void {
        parameters = { ...parameters, [key]: value };
    }

    onMount(() => {
        // Initialize parameters with defaults
        if (skill.configFields) {
            for (const field of skill.configFields) {
                if (field.default !== undefined) {
                    parameters[field.key] = field.default;
                }
            }
        }
    });
</script>

<div class="skill-detail h-full flex flex-col">
    <!-- Header -->
    <div class="detail-header p-4 border-b border-white/10">
        <div class="flex items-center gap-3">
            <button
                class="p-1 rounded hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                on:click={onClose}
                aria-label="Go back"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
                </svg>
            </button>
            <div class="skill-icon text-3xl">
                {getIconComponent(skill.icon)}
            </div>
            <div class="flex-1">
                <h3 class="text-white font-semibold text-lg">{skill.name}</h3>
                <div class="flex items-center gap-2 text-sm">
                    <span class="px-2 py-0.5 rounded {getTypeBadgeColor(skill.type)}">{skill.type}</span>
                    <span class="text-white/50">v{skill.version}</span>
                    <span class="text-white/40">by {skill.author}</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Content -->
    <div class="detail-content flex-1 overflow-y-auto p-4 space-y-4">
        <!-- Description -->
        <div class="section">
            <h4 class="text-white/70 text-xs uppercase tracking-wider mb-2">Description</h4>
            <p class="text-white/90 text-sm">{skill.description}</p>
        </div>

        <!-- Info -->
        <div class="section grid grid-cols-2 gap-4">
            <div>
                <h4 class="text-white/70 text-xs uppercase tracking-wider mb-1">Skill Type</h4>
                <p class="text-white text-sm capitalize">{skill.type}</p>
            </div>
            <div>
                <h4 class="text-white/70 text-xs uppercase tracking-wider mb-1">Execution Mode</h4>
                <p class="text-white text-sm capitalize">{skill.executionMode}</p>
            </div>
        </div>

        <!-- Permissions -->
        {#if skill.permissions && skill.permissions.length > 0}
            <div class="section">
                <h4 class="text-white/70 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span class="text-yellow-400">⚠️</span>
                    Permissions Required
                </h4>
                <ul class="space-y-1">
                    {#each skill.permissions as permission}
                        <li class="flex items-center gap-2 text-sm">
                            <span>{getPermissionIcon(permission.type)}</span>
                            <span class="text-white/80">{permission.description}</span>
                            {#if permission.required}
                                <span class="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Required</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
            </div>
        {/if}

        <!-- Targets -->
        {#if skill.installed}
            <div class="section">
                <h4 class="text-white/70 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>🎯</span>
                    Execution Target
                </h4>
                <div class="space-y-2">
                    <label class="flex items-center gap-2 p-2 rounded border border-white/10 hover:bg-white/5 cursor-pointer">
                        <input
                            type="radio"
                            name="target"
                            value=""
                            bind:group={selectedTargetId}
                            class="text-purple-500"
                        />
                        <span class="text-white/80 text-sm">Server Execution (OpenClaw Server)</span>
                    </label>
                    {#each targets as target}
                        <label class="flex items-center gap-2 p-2 rounded border border-white/10 hover:bg-white/5 cursor-pointer">
                            <input
                                type="radio"
                                name="target"
                                value={target.id}
                                bind:group={selectedTargetId}
                                class="text-purple-500"
                            />
                            <span class="text-white/80 text-sm">{target.name}</span>
                            <span class="text-xs text-white/40">({target.type})</span>
                            {#if target.status === 'online'}
                                <span class="w-2 h-2 rounded-full bg-green-400"></span>
                            {:else if target.status === 'offline'}
                                <span class="w-2 h-2 rounded-full bg-red-400"></span>
                            {:else}
                                <span class="w-2 h-2 rounded-full bg-gray-400"></span>
                            {/if}
                        </label>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Configuration -->
        {#if skill.installed && skill.configFields && skill.configFields.length > 0}
            <div class="section">
                <h4 class="text-white/70 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
                    <span>⚙️</span>
                    Execution Parameters
                </h4>
                <div class="space-y-3">
                    {#each skill.configFields as field}
                        <div>
                            <label class="block text-white/80 text-sm mb-1">
                                {field.label}
                                {#if field.required}
                                    <span class="text-red-400">*</span>
                                {/if}
                            </label>
                            {#if field.description}
                                <p class="text-white/50 text-xs mb-1">{field.description}</p>
                            {/if}
                            {#if field.type === 'string'}
                                <input
                                    type="text"
                                    class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                                    placeholder={field.default?.toString() || ''}
                                    on:change={(e) => handleConfigChange(field.key, (e.target as HTMLInputElement).value)}
                                />
                            {:else if field.type === 'number'}
                                <input
                                    type="number"
                                    class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                                    placeholder={field.default?.toString() || '0'}
                                    on:change={(e) => handleConfigChange(field.key, parseFloat((e.target as HTMLInputElement).value))}
                                />
                            {:else if field.type === 'boolean'}
                                <label class="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        class="text-purple-500 rounded"
                                        checked={field.default as boolean}
                                        on:change={(e) => handleConfigChange(field.key, (e.target as HTMLInputElement).checked)}
                                    />
                                    <span class="text-white/70 text-sm">Enabled</span>
                                </label>
                            {:else if field.type === 'select' && field.options}
                                <select
                                    class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                                    on:change={(e) => handleConfigChange(field.key, (e.target as HTMLSelectElement).value)}
                                >
                                    {#each field.options as option}
                                        <option value={option.value}>{option.label}</option>
                                    {/each}
                                </select>
                            {:else if field.type === 'json'}
                                <textarea
                                    class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                                    rows="3"
                                    placeholder={JSON.stringify(field.default || {}, null, 2)}
                                    on:change={(e) => {
                                        try {
                                            handleConfigChange(field.key, JSON.parse((e.target as HTMLTextAreaElement).value));
                                        } catch {
                                            // Keep previous value if invalid JSON
                                        }
                                    }}
                                ></textarea>
                            {/if}
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <!-- Footer Actions -->
    <div class="detail-footer p-4 border-t border-white/10">
        <div class="flex items-center gap-2">
            {#if skill.installed}
                <button
                    class="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    on:click={handleExecuteClick}
                >
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                    </svg>
                    Execute
                </button>
                <button
                    class="py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                    on:click={() => showConfig = !showConfig}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                </button>
                <button
                    class="py-2.5 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition-colors"
                    on:click={handleUninstallClick}
                    disabled={isInstalling}
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                    </svg>
                </button>
            {:else}
                <button
                    class="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    on:click={handleInstallClick}
                    disabled={isInstalling}
                >
                    {#if isInstalling}
                        <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Installing...
                    {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                        </svg>
                        Install
                    {/if}
                </button>
            {/if}
        </div>
    </div>
</div>

<style lang="scss">
    .skill-detail {
        background: linear-gradient(180deg, rgba(88, 28, 135, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
    }

    .section {
        padding: 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    input[type="radio"] {
        &:checked {
            accent-color: #a855f7;
        }
    }

    select {
        option {
            background: #1a1a2e;
            color: white;
        }
    }
</style>
