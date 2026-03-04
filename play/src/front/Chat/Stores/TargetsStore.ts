/**
 * Targets Store - Manages target state and operations
 */

import { get, writable, derived, type Readable, type Writable } from "svelte/store";
import { getOpenClawConnection } from "../Connection/OpenClaw/OpenClawConnection";
import type {
    SkillTarget,
    TargetType,
    TargetStatus,
    TargetsListResponse,
    TargetRegisterResponse,
    TargetStatusResponse,
} from "@workadventure/openclaw-client";

/**
 * Target form state for creating/editing
 */
export interface TargetFormData {
    name: string;
    type: TargetType;
    icon: string;
    description: string;
    config: Record<string, unknown>;
}

/**
 * Targets store state
 */
interface TargetsState {
    targets: SkillTarget[];
    loading: boolean;
    error?: string;
    selectedTarget: SkillTarget | null;
    filterType: TargetType | null;
    filterStatus: TargetStatus | null;
    registering: boolean;
    checkingStatus: boolean;
}

/**
 * Create the Targets store
 */
function createTargetsStore() {
    const state: Writable<TargetsState> = writable({
        targets: [],
        loading: false,
        error: undefined,
        selectedTarget: null,
        filterType: null,
        filterStatus: null,
        registering: false,
        checkingStatus: false,
    });

    return {
        subscribe: state.subscribe,

        /**
         * Load all targets
         */
        async loadTargets(): Promise<void> {
            state.update((s) => ({ ...s, loading: true, error: undefined }));

            try {
                const connection = getOpenClawConnection();
                if (!connection.isConnected()) {
                    await connection.connect();
                }

                const response = await connection.sendRequest<TargetsListResponse>(
                    { type: "targets.list", payload: {} },
                    "targets-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    targets: response.targets || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to load targets",
                }));
            }
        },

        /**
         * Filter targets by type
         */
        async filterByType(type: TargetType | null): Promise<void> {
            state.update((s) => ({ ...s, filterType: type, loading: true }));

            try {
                const connection = getOpenClawConnection();
                const payload: { type?: TargetType } = {};
                if (type) {
                    payload.type = type;
                }
                if (get(state).filterStatus) {
                    (payload as { status?: TargetStatus }).status = get(state).filterStatus!;
                }

                const response = await connection.sendRequest<TargetsListResponse>(
                    { type: "targets.list", payload },
                    "targets-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    targets: response.targets || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to filter targets",
                }));
            }
        },

        /**
         * Filter targets by status
         */
        async filterByStatus(status: TargetStatus | null): Promise<void> {
            state.update((s) => ({ ...s, filterStatus: status, loading: true }));

            try {
                const connection = getOpenClawConnection();
                const payload: { status?: TargetStatus; type?: TargetType } = {};
                if (status) {
                    payload.status = status;
                }
                if (get(state).filterType) {
                    payload.type = get(state).filterType!;
                }

                const response = await connection.sendRequest<TargetsListResponse>(
                    { type: "targets.list", payload },
                    "targets-list-" + Date.now()
                );

                state.update((s) => ({
                    ...s,
                    targets: response.targets || [],
                    loading: false,
                }));
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    loading: false,
                    error: error instanceof Error ? error.message : "Failed to filter targets",
                }));
            }
        },

        /**
         * Select a target for viewing/editing
         */
        selectTarget(target: SkillTarget | null): void {
            state.update((s) => ({ ...s, selectedTarget: target }));
        },

        /**
         * Register a new target
         */
        async registerTarget(formData: TargetFormData): Promise<SkillTarget | null> {
            state.update((s) => ({ ...s, registering: true, error: undefined }));

            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<TargetRegisterResponse>(
                    {
                        type: "targets.register",
                        payload: {
                            name: formData.name,
                            type: formData.type,
                            icon: formData.icon,
                            description: formData.description,
                            config: formData.config,
                        },
                    },
                    "targets-register-" + Date.now()
                );

                if (response.success && response.target) {
                    state.update((s) => ({
                        ...s,
                        targets: [...s.targets, response.target!],
                        registering: false,
                    }));
                    return response.target;
                } else {
                    throw new Error(response.message || "Registration failed");
                }
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    registering: false,
                    error: error instanceof Error ? error.message : "Failed to register target",
                }));
                return null;
            }
        },

        /**
         * Unregister a target
         */
        async unregisterTarget(targetId: string): Promise<boolean> {
            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<{ success: boolean; message?: string }>(
                    {
                        type: "targets.unregister",
                        payload: { targetId },
                    },
                    "targets-unregister-" + targetId
                );

                if (response.success) {
                    state.update((s) => ({
                        ...s,
                        targets: s.targets.filter((t) => t.id !== targetId),
                        selectedTarget: s.selectedTarget?.id === targetId ? null : s.selectedTarget,
                    }));
                    return true;
                } else {
                    throw new Error(response.message || "Unregistration failed");
                }
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    error: error instanceof Error ? error.message : "Failed to unregister target",
                }));
                return false;
            }
        },

        /**
         * Check status of a target
         */
        async checkTargetStatus(targetId: string): Promise<TargetStatus | null> {
            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<TargetStatusResponse>(
                    {
                        type: "targets.status",
                        payload: { targetId },
                    },
                    "targets-status-" + targetId
                );

                // Update target status in store
                state.update((s) => ({
                    ...s,
                    targets: s.targets.map((t) =>
                        t.id === targetId ? { ...t, status: response.status, lastChecked: response.lastChecked } : t
                    ),
                }));

                return response.status;
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    error: error instanceof Error ? error.message : "Failed to check target status",
                }));
                return null;
            }
        },

        /**
         * Check status of all targets
         */
        async checkAllTargetsStatus(): Promise<void> {
            state.update((s) => ({ ...s, checkingStatus: true }));

            try {
                const connection = getOpenClawConnection();
                const response = await connection.sendRequest<{ targets: Array<{ targetId: string; status: TargetStatus; lastChecked: number }> }>(
                    {
                        type: "targets.status",
                        payload: {},
                    },
                    "targets-status-all-" + Date.now()
                );

                if (response.targets) {
                    state.update((s) => {
                        const statusMap = new Map(response.targets.map((t) => [t.targetId, t]));
                        return {
                            ...s,
                            targets: s.targets.map((t) => {
                                const statusInfo = statusMap.get(t.id);
                                return statusInfo ? { ...t, status: statusInfo.status, lastChecked: statusInfo.lastChecked } : t;
                            }),
                            checkingStatus: false,
                        };
                    });
                }
            } catch (error) {
                state.update((s) => ({
                    ...s,
                    checkingStatus: false,
                    error: error instanceof Error ? error.message : "Failed to check targets status",
                }));
            }
        },

        /**
         * Bind a skill to a target
         */
        bindSkillToTarget(targetId: string, skillId: string): void {
            state.update((s) => ({
                ...s,
                targets: s.targets.map((t) => {
                    if (t.id === targetId) {
                        const boundSkills = t.boundSkills || [];
                        if (!boundSkills.includes(skillId)) {
                            return { ...t, boundSkills: [...boundSkills, skillId] };
                        }
                    }
                    return t;
                }),
            }));
        },

        /**
         * Unbind a skill from a target
         */
        unbindSkillFromTarget(targetId: string, skillId: string): void {
            state.update((s) => ({
                ...s,
                targets: s.targets.map((t) => {
                    if (t.id === targetId && t.boundSkills) {
                        return { ...t, boundSkills: t.boundSkills.filter((id) => id !== skillId) };
                    }
                    return t;
                }),
            }));
        },

        /**
         * Get target by ID
         */
        getTarget(targetId: string): SkillTarget | undefined {
            return get(state).targets.find((t) => t.id === targetId);
        },

        /**
         * Get targets by type
         */
        getTargetsByType(type: TargetType): SkillTarget[] {
            return get(state).targets.filter((t) => t.type === type);
        },

        /**
         * Get targets bound to a skill
         */
        getTargetsBoundToSkill(skillId: string): SkillTarget[] {
            return get(state).targets.filter((t) => t.boundSkills?.includes(skillId));
        },

        /**
         * Clear error
         */
        clearError(): void {
            state.update((s) => ({ ...s, error: undefined }));
        },

        /**
         * Reset filters
         */
        resetFilters(): void {
            state.update((s) => ({ ...s, filterType: null, filterStatus: null }));
            this.loadTargets();
        },
    };
}

export const targetsStore = createTargetsStore();

/**
 * Derived store for online targets
 */
export const onlineTargets: Readable<SkillTarget[]> = derived(targetsStore, ($store) =>
    $store.targets.filter((t) => t.status === "online")
);

/**
 * Derived store for targets by type
 */
export const targetsByType: Readable<Map<TargetType, SkillTarget[]>> = derived(targetsStore, ($store) => {
    const map = new Map<TargetType, SkillTarget[]>();
    for (const target of $store.targets) {
        const targets = map.get(target.type) || [];
        targets.push(target);
        map.set(target.type, targets);
    }
    return map;
});

/**
 * Derived store for device targets
 */
export const deviceTargets: Readable<SkillTarget[]> = derived(targetsStore, ($store) =>
    $store.targets.filter((t) => t.type === "device")
);

/**
 * Derived store for virtual area targets
 */
export const virtualAreaTargets: Readable<SkillTarget[]> = derived(targetsStore, ($store) =>
    $store.targets.filter((t) => t.type === "virtual-area")
);

/**
 * Derived store for external API targets
 */
export const externalApiTargets: Readable<SkillTarget[]> = derived(targetsStore, ($store) =>
    $store.targets.filter((t) => t.type === "external-api")
);

/**
 * Derived store for open project targets
 */
export const openProjectTargets: Readable<SkillTarget[]> = derived(targetsStore, ($store) =>
    $store.targets.filter((t) => t.type === "open-project")
);

/**
 * Derived store for checking if targets are available
 */
export const areTargetsAvailable: Readable<boolean> = derived(
    targetsStore,
    ($store) => !$store.loading && $store.targets.length > 0
);
