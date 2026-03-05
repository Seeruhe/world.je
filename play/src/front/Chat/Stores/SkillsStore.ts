/**
 * Skills Store - Manages skill state and operations
 */

import { get, writable, derived, type Readable, type Writable } from "svelte/store";
import { getOpenClawConnection } from "../Connection/OpenClaw/OpenClawConnection";
import type {
    Skill,
    SkillPermission,
    SkillsListResponse,
    SkillInstallResponse,
    SkillExecuteResponse,
} from "@workadventure/openclaw-client";

/**
 * Skill installation state
 */
export interface SkillInstallState {
    skillId: string;
    status: "idle" | "installing" | "installed" | "uninstalling" | "error";
    error?: string;
    progress?: number;
}

/**
 * Skill execution state
 */
export interface SkillExecutionState {
    executionId: string;
    skillId: string;
    targetId?: string;
    status: "pending" | "running" | "completed" | "failed";
    output?: unknown;
    error?: string;
    logs: string[];
    startTime: number;
    endTime?: number;
}

/**
 * Skills store state
 */
interface SkillsState {
    skills: Skill[];
    categories: string[];
    loading: boolean;
    error?: string;
    installStates: Map<string, SkillInstallState>;
    executions: Map<string, SkillExecutionState>;
    selectedSkill: Skill | null;
    selectedCategory: string | null;
    showInstalledOnly: boolean;
}

/**
 * Create the Skills store
 */
function createSkillsStore() {
    const state: Writable<SkillsState> = writable({
        skills: [],
        categories: [],
        loading: false,
        error: undefined,
        installStates: new Map(),
        executions: new Map(),
        selectedSkill: null,
        selectedCategory: null,
        showInstalledOnly: false,
    });

    return {
        subscribe: state.subscribe,

        /**
         * Load all available skills
         */
        async loadSkills(): Promise<void> {
            state.update((s) => ({ ...s, loading: true, error: undefined }));

            try {
                const connection = getOpenClawConnection();
                if (!connection.isConnected()) {
                    await connection.connect();
                }

                const response = await connection.sendRequest<SkillsListResponse>(
                    { type: "skills.list", payload: {} },
                    "skills-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    skills: response.skills || [],
                    categories: response.categories || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to load skills",
                }));
            }
        },

        /**
         * Filter skills by category
         */
        async filterByCategory(category: string | null): Promise<void> {
            state.update((s) => ({ ...s, selectedCategory: category, loading: true }));

            try {
                const connection = getOpenClawConnection();
                const payload = category ? { category } : {};
                const response = await connection.sendRequest<SkillsListResponse>(
                    { type: "skills.list", payload },
                    "skills-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    skills: response.skills || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to filter skills",
                }));
            }
        },

        /**
         * Toggle showing only installed skills
         */
        async toggleInstalledOnly(): Promise<void> {
            const current = get(state);
            const showInstalledOnly = !current.showInstalledOnly;

            state.update((s) => ({ ...s, showInstalledOnly, loading: true }));

            try {
                const connection = getOpenClawConnection();
                const payload: { installed?: boolean } = {};
                if (showInstalledOnly) {
                    payload.installed = true;
                }
                if (current.selectedCategory) {
                    (payload as { category?: string }).category = current.selectedCategory;
                }

                const response = await connection.sendRequest<SkillsListResponse>(
                    { type: "skills.list", payload },
                    "skills-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    skills: response.skills || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to filter skills",
                }));
            }
        },

        /**
         * Select a skill for viewing details
         */
        selectSkill(skill: Skill | null): void {
            state.update((s) => ({ ...s, selectedSkill: skill }));
        },

        /**
         * Install a skill
         */
        async installSkill(
            skillId: string,
            userConfig?: Record<string, unknown>,
            targetBindings?: string[],
            grantedPermissions?: string[]
        ): Promise<boolean> {
            const installState: SkillInstallState = {
                skillId,
                status: "installing",
                progress: 0,
            };
            state.update((s) => {
                const newStates = new Map(s.installStates);
                newStates.set(skillId, installState);
                return { ...s, installStates: newStates };
            });

            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<SkillInstallResponse>(
                    {
                        type: "skills.install",
                        payload: {
                            skillId,
                            userConfig,
                            targetBindings,
                            grantedPermissions,
                        },
                    },
                    "skills-install-" + skillId
                );

                if (response.success) {
                    state.update((s) => {
                        const newStates = new Map(s.installStates);
                        newStates.set(skillId, { skillId, status: "installed" });
                        const newSkills = s.skills.map((sk) =>
                            sk.id === skillId ? { ...sk, installed: true, installPath: response.installPath } : sk
                        );
                        return { ...s, installStates: newStates, skills: newSkills };
                    });
                    return true;
                } else {
                    throw new Error(response.message || "Installation failed");
                }
            } catch (error) {
                state.update((s) => {
                    const newStates = new Map(s.installStates);
                    newStates.set(skillId, {
                        skillId,
                        status: "error",
                        error: error instanceof Error ? error.message : "Installation failed",
                    });
                    return { ...s, installStates: newStates };
                });
                return false;
            }
        },

        /**
         * Uninstall a skill
         */
        async uninstallSkill(skillId: string): Promise<boolean> {
            state.update((s) => {
                const newStates = new Map(s.installStates);
                newStates.set(skillId, { skillId, status: "uninstalling" });
                return { ...s, installStates: newStates };
            });

            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<{ success: boolean; message?: string }>(
                    {
                        type: "skills.uninstall",
                        payload: { skillId },
                    },
                    "skills-uninstall-" + skillId
                );

                if (response.success) {
                    state.update((s) => {
                        const newStates = new Map(s.installStates);
                        newStates.delete(skillId);
                        const newSkills = s.skills.map((sk) =>
                            sk.id === skillId ? { ...sk, installed: false, installPath: undefined } : sk
                        );
                        return { ...s, installStates: newStates, skills: newSkills };
                    });
                    return true;
                } else {
                    throw new Error(response.message || "Uninstallation failed");
                }
            } catch (error) {
                state.update((s) => {
                    const newStates = new Map(s.installStates);
                    newStates.set(skillId, {
                        skillId,
                        status: "error",
                        error: error instanceof Error ? error.message : "Uninstallation failed",
                    });
                    return { ...s, installStates: newStates };
                });
                return false;
            }
        },

        /**
         * Execute a skill
         */
        async executeSkill(
            skillId: string,
            parameters?: Record<string, unknown>,
            targetId?: string,
            executionMode?: "server" | "agent"
        ): Promise<string | null> {
            const executionId = `exec-${Date.now()}`;
            const executionState: SkillExecutionState = {
                executionId,
                skillId,
                targetId,
                status: "pending",
                logs: [],
                startTime: Date.now(),
            };

            state.update((s) => {
                const newExecutions = new Map(s.executions);
                newExecutions.set(executionId, executionState);
                return { ...s, executions: newExecutions };
            });

            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<SkillExecuteResponse>(
                    {
                        type: "skills.execute",
                        payload: {
                            skillId,
                            parameters,
                            targetId,
                            executionMode,
                        },
                    },
                    "skills-execute-" + skillId
                );

                state.update((s) => {
                    const newExecutions = new Map(s.executions);
                    newExecutions.set(executionId, {
                        ...executionState,
                        executionId: response.executionId || executionId,
                        status: response.status,
                        output: response.output,
                        error: response.error,
                        logs: response.logs || [],
                        endTime: response.status === "completed" || response.status === "failed" ? Date.now() : undefined,
                    });
                    return { ...s, executions: newExecutions };
                });

                return response.executionId;
            } catch (error) {
                state.update((s) => {
                    const newExecutions = new Map(s.executions);
                    newExecutions.set(executionId, {
                        ...executionState,
                        status: "failed",
                        error: error instanceof Error ? error.message : "Execution failed",
                        endTime: Date.now(),
                    });
                    return { ...s, executions: newExecutions };
                });
                return null;
            }
        },

        /**
         * Get skill by ID
         */
        getSkill(skillId: string): Skill | undefined {
            return get(state).skills.find((s) => s.id === skillId);
        },

        /**
         * Get install state for a skill
         */
        getInstallState(skillId: string): SkillInstallState | undefined {
            return get(state).installStates.get(skillId);
        },

        /**
         * Get execution state
         */
        getExecutionState(executionId: string): SkillExecutionState | undefined {
            return get(state).executions.get(executionId);
        },

        /**
         * Clear all execution history
         */
        clearExecutions(): void {
            state.update((s) => ({ ...s, executions: new Map() }));
        },

        /**
         * Clear error
         */
        clearError(): void {
            state.update((s) => ({ ...s, error: undefined }));
        },
    };
}

export const skillsStore = createSkillsStore();

/**
 * Store for skills panel visibility
 */
export const skillsPanelStore = writable<boolean>(false);

/**
 * Derived store for installed skills
 */
export const installedSkills: Readable<Skill[]> = derived(skillsStore, ($store) =>
    $store.skills.filter((s) => s.installed)
);

/**
 * Derived store for skills by category
 */
export const skillsByCategory: Readable<Map<string, Skill[]>> = derived(skillsStore, ($store) => {
    const map = new Map<string, Skill[]>();
    for (const skill of $store.skills) {
        const skills = map.get(skill.category) || [];
        skills.push(skill);
        map.set(skill.category, skills);
    }
    return map;
});

/**
 * Derived store for checking if skills are available
 */
export const areSkillsAvailable: Readable<boolean> = derived(
    skillsStore,
    ($store) => !$store.loading && $store.skills.length > 0
);
