<script lang="ts">
    import { onMount } from "svelte";
    import { get } from "svelte/store";
    import type { Skill } from "@workadventure/openclaw-client";
    import { skillsStore, installedSkills } from "../../Stores/SkillsStore";
    import SkillCard from "./SkillCard.svelte";
    import SkillDetail from "./SkillDetail.svelte";

    export let onClose: () => void;

    let searchQuery = "";
    let selectedCategory: string | null = null;
    let showInstalledOnly = false;
    let selectedSkill: Skill | null = null;

    $: state = get(skillsStore);
    $: categories = state.categories;
    $: filteredSkills = state.skills.filter((skill) => {
        // Filter by search query
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            if (
                !skill.name.toLowerCase().includes(query) &&
                !skill.description.toLowerCase().includes(query)
            ) {
                return false;
            }
        }
        // Filter by category
        if (selectedCategory && skill.category !== selectedCategory) {
            return false;
        }
        // Filter by installed status
        if (showInstalledOnly && !skill.installed) {
            return false;
        }
        return true;
    });
    $: installedCount = get(installedSkills).length;

    async function handleInstall(skill: Skill): Promise<void> {
        await skillsStore.installSkill(skill.id);
    }

    async function handleUninstall(skill: Skill): Promise<void> {
        await skillsStore.uninstallSkill(skill.id);
    }

    async function handleExecute(skill: Skill, targetId?: string, parameters?: Record<string, unknown>): Promise<void> {
        await skillsStore.executeSkill(skill.id, parameters, targetId);
    }

    function handleSelectSkill(skill: Skill): void {
        selectedSkill = skill;
    }

    function handleCloseDetail(): void {
        selectedSkill = null;
    }

    async function handleCategoryClick(category: string | null): Promise<void> {
        selectedCategory = category;
        await skillsStore.filterByCategory(category);
    }

    async function handleToggleInstalled(): Promise<void> {
        await skillsStore.toggleInstalledOnly();
        showInstalledOnly = !showInstalledOnly;
    }

    onMount(() => {
        skillsStore.loadSkills();
    });
</script>

<div class="skills-panel h-full flex flex-col">
    <!-- Header -->
    <div class="panel-header p-4 border-b border-white/10">
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
                <span class="text-2xl">🤖</span>
                <h2 class="text-white font-semibold text-lg">Skills Store</h2>
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

        <!-- Search and Filter -->
        <div class="flex items-center gap-2 mb-3">
            <div class="flex-1 relative">
                <input
                    type="text"
                    class="w-full px-3 py-2 pl-9 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:border-purple-500/50 outline-none"
                    placeholder="Search skills..."
                    bind:value={searchQuery}
                />
                <svg class="w-4 h-4 text-white/30 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
            </div>
            <button
                class="px-3 py-2 rounded-lg text-sm transition-colors {showInstalledOnly ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}"
                on:click={handleToggleInstalled}
            >
                📂 My Skills ({installedCount})
            </button>
        </div>

        <!-- Categories -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1">
            <button
                class="category-btn px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors {!selectedCategory ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}"
                on:click={() => handleCategoryClick(null)}
            >
                All
            </button>
            {#each categories as category}
                <button
                    class="category-btn px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors {selectedCategory === category ? 'bg-purple-500 text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'}"
                    on:click={() => handleCategoryClick(category)}
                >
                    {category}
                </button>
            {/each}
        </div>
    </div>

    <!-- Content -->
    <div class="panel-content flex-1 overflow-hidden">
        {#if selectedSkill}
            <SkillDetail
                skill={selectedSkill}
                onClose={handleCloseDetail}
                onInstall={handleInstall}
                onUninstall={handleUninstall}
                onExecute={handleExecute}
            />
        {:else}
            <div class="h-full overflow-y-auto p-4">
                {#if state.loading}
                    <div class="flex items-center justify-center h-32">
                        <svg class="w-8 h-8 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                    </div>
                {:else if state.error}
                    <div class="text-center py-8">
                        <p class="text-red-400 text-sm">{state.error}</p>
                        <button
                            class="mt-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm"
                            on:click={() => skillsStore.loadSkills()}
                        >
                            Retry
                        </button>
                    </div>
                {:else if filteredSkills.length === 0}
                    <div class="text-center py-8">
                        <p class="text-white/50 text-sm">No skills found</p>
                        {#if searchQuery || selectedCategory || showInstalledOnly}
                            <button
                                class="mt-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm"
                                on:click={() => {
                                    searchQuery = '';
                                    selectedCategory = null;
                                    showInstalledOnly = false;
                                    skillsStore.loadSkills();
                                }}
                            >
                                Clear filters
                            </button>
                        {/if}
                    </div>
                {:else}
                    <div class="grid gap-3">
                        {#each filteredSkills as skill (skill.id)}
                            <SkillCard
                                {skill}
                                onInstall={handleInstall}
                                onSelect={handleSelectSkill}
                            />
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .skills-panel {
        background: linear-gradient(180deg, rgba(88, 28, 135, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
    }

    .category-btn {
        &:focus {
            outline: 2px solid rgba(147, 51, 234, 0.5);
            outline-offset: 2px;
        }
    }
</style>
