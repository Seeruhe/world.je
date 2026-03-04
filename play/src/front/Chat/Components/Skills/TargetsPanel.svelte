<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import type { SkillTarget, TargetType, TargetStatus } from "@workadventure/openclaw-client";
    import { targetsStore, onlineTargets } from "../../Stores/TargetsStore";

    export let onClose: () => void;

    let showAddTarget = false;
    let editingTarget: SkillTarget | null = null;

    // Form state for new target
    let newTarget = {
        name: "",
        type: "device" as TargetType,
        icon: "",
        description: "",
        config: {} as Record<string, unknown>,
    };

    $: state = get(targetsStore);
    $: targets = state.targets;
    $: onlineCount = get(onlineTargets).length;

    function getIconForType(type: TargetType): string {
        const icons: Record<TargetType, string> = {
            device: "🖥️",
            "virtual-area": "📍",
            "external-api": "🌐",
            "open-project": "📦",
        };
        return icons[type] || "🎯";
    }

    function getStatusColor(status: TargetStatus): string {
        const colors: Record<TargetStatus, string> = {
            online: "bg-green-400",
            offline: "bg-red-400",
            unknown: "bg-gray-400",
            error: "bg-yellow-400",
        };
        return colors[status] || "bg-gray-400";
    }

    function getTypeLabel(type: TargetType): string {
        const labels: Record<TargetType, string> = {
            device: "Device",
            "virtual-area": "Virtual Area",
            "external-api": "External API",
            "open-project": "Open Project",
        };
        return labels[type] || type;
    }

    async function handleRegisterTarget(): Promise<void> {
        if (!newTarget.name || !newTarget.type) return;

        const result = await targetsStore.registerTarget({
            name: newTarget.name,
            type: newTarget.type,
            icon: newTarget.icon || getIconForType(newTarget.type),
            description: newTarget.description,
            config: newTarget.config,
        });

        if (result) {
            // Reset form
            newTarget = {
                name: "",
                type: "device",
                icon: "",
                description: "",
                config: {},
            };
            showAddTarget = false;
        }
    }

    async function handleUnregisterTarget(targetId: string): Promise<void> {
        if (confirm("Are you sure you want to remove this target?")) {
            await targetsStore.unregisterTarget(targetId);
        }
    }

    async function handleCheckStatus(targetId?: string): Promise<void> {
        if (targetId) {
            await targetsStore.checkTargetStatus(targetId);
        } else {
            await targetsStore.checkAllTargetsStatus();
        }
    }

    function handleEditTarget(target: SkillTarget): void {
        editingTarget = target;
    }

    onMount(() => {
        targetsStore.loadTargets();
    });
</script>

<div class="targets-panel h-full flex flex-col">
    <!-- Header -->
    <div class="panel-header p-4 border-b border-white/10">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <span class="text-2xl">🎯</span>
                <h2 class="text-white font-semibold text-lg">Target Management</h2>
            </div>
            <button
                class="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
                on:click={onClose}
                aria-label="Close panel"
            >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                </svg>
            </button>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
            <button
                class="flex-1 py-2 px-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                on:click={() => showAddTarget = !showAddTarget}
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
                </svg>
                Add Target
            </button>
            <button
                class="py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors flex items-center justify-center gap-2"
                on:click={() => handleCheckStatus()}
                disabled={state.checkingStatus}
            >
                {#if state.checkingStatus}
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                {/if}
                Refresh
            </button>
        </div>

        <!-- Stats -->
        <div class="flex items-center gap-4 mt-3 text-xs text-white/50">
            <span>{targets.length} total</span>
            <span>•</span>
            <span class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full bg-green-400"></span>
                {onlineCount} online
            </span>
        </div>
    </div>

    <!-- Content -->
    <div class="panel-content flex-1 overflow-y-auto p-4">
        <!-- Add Target Form -->
        {#if showAddTarget}
            <div class="mb-4 p-4 rounded-lg border border-purple-500/30 bg-purple-500/10">
                <h3 class="text-white font-medium text-sm mb-3">Add New Target</h3>
                <div class="space-y-3">
                    <div>
                        <label class="block text-white/70 text-xs mb-1">Name *</label>
                        <input
                            type="text"
                            class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                            placeholder="My Device"
                            bind:value={newTarget.name}
                        />
                    </div>
                    <div>
                        <label class="block text-white/70 text-xs mb-1">Type *</label>
                        <select
                            class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                            bind:value={newTarget.type}
                        >
                            <option value="device">🖥️ Device</option>
                            <option value="virtual-area">📍 Virtual Area</option>
                            <option value="external-api">🌐 External API</option>
                            <option value="open-project">📦 Open Project</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-white/70 text-xs mb-1">Description</label>
                        <input
                            type="text"
                            class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                            placeholder="Optional description"
                            bind:value={newTarget.description}
                        />
                    </div>
                    <div class="flex gap-2">
                        <button
                            class="flex-1 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm transition-colors"
                            on:click={handleRegisterTarget}
                            disabled={!newTarget.name}
                        >
                            Add Target
                        </button>
                        <button
                            class="py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                            on:click={() => showAddTarget = false}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Error State -->
        {#if state.error}
            <div class="text-center py-4 mb-4">
                <p class="text-red-400 text-sm">{state.error}</p>
                <button
                    class="mt-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm"
                    on:click={() => targetsStore.loadTargets()}
                >
                    Retry
                </button>
            </div>
        {/if}

        <!-- Loading State -->
        {#if state.loading}
            <div class="flex items-center justify-center h-32">
                <svg class="w-8 h-8 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
            </div>
        {:else if targets.length === 0}
            <div class="text-center py-8">
                <p class="text-white/50 text-sm">No targets registered</p>
                <p class="text-white/30 text-xs mt-1">Click "Add Target" to add your first target</p>
            </div>
        {:else}
            <!-- Target List -->
            <div class="space-y-3">
                {#each targets as target (target.id)}
                    <div class="target-card p-4 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all">
                        <div class="flex items-start gap-3">
                            <!-- Icon -->
                            <div class="text-2xl">
                                {target.icon || getIconForType(target.type)}
                            </div>

                            <!-- Content -->
                            <div class="flex-1 min-w-0">
                                <div class="flex items-center gap-2 mb-1">
                                    <h4 class="text-white font-medium text-sm truncate">{target.name}</h4>
                                    <span class="w-2 h-2 rounded-full {getStatusColor(target.status)}"></span>
                                </div>
                                <div class="flex items-center gap-2 text-xs text-white/50 mb-2">
                                    <span>{getTypeLabel(target.type)}</span>
                                    {#if target.description}
                                        <span>•</span>
                                        <span class="truncate">{target.description}</span>
                                    {/if}
                                </div>
                                {#if target.boundSkills && target.boundSkills.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        <span class="text-xs text-white/40">Skills:</span>
                                        {#each target.boundSkills as skillId}
                                            <span class="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60">{skillId}</span>
                                        {/each}
                                    </div>
                                {/if}
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-1">
                                <button
                                    class="p-2 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                                    on:click={() => handleCheckStatus(target.id)}
                                    title="Check status"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                                    </svg>
                                </button>
                                <button
                                    class="p-2 rounded hover:bg-white/10 text-white/50 hover:text-white/80 transition-colors"
                                    on:click={() => handleEditTarget(target)}
                                    title="Edit"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                </button>
                                <button
                                    class="p-2 rounded hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                                    on:click={() => handleUnregisterTarget(target.id)}
                                    title="Remove"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .targets-panel {
        background: linear-gradient(180deg, rgba(88, 28, 135, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
    }

    select {
        option {
            background: #1a1a2e;
            color: white;
        }
    }
</style>
