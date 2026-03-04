<script lang="ts">
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";
    import { getOpenClawConnection } from "../../Connection/OpenClaw/OpenClawConnection";

    export let onClose: () => void;

    // Configuration state
    let config = writable({
        // AI Provider Settings
        anthropicApiKey: "",
        anthropicBaseUrl: "https://open.bigmodel.cn/api/anthropic",
        defaultModel: "glm-5",
        openaiApiKey: "",
        googleApiKey: "",

        // Proxy Settings
        httpProxy: "",
        httpsProxy: "",
        noProxy: "localhost,127.0.0.1,.cluster.local,.svc,10.96.0.0/12,10.0.0.3",

        // Gateway Settings
        gatewayEnabled: true,
        triggerPrefix: "@AI",

        // Advanced Settings
        timeout: "30000",
        maxTokens: "4096",
    });

    let isSaving = false;
    let savedMessage = "";
    let testResult = "";
    let isTesting = false;

    // Available models
    const availableModels = [
        { value: "glm-5", label: "GLM-5 (智谱)", provider: "zhipu" },
        { value: "glm-4-plus", label: "GLM-4 Plus (智谱)", provider: "zhipu" },
        { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "anthropic" },
        { value: "claude-3-opus-20240229", label: "Claude 3 Opus", provider: "anthropic" },
        { value: "gpt-4o", label: "GPT-4o", provider: "openai" },
        { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "openai" },
    ];

    function loadConfig(): void {
        // Load from localStorage
        const savedConfig = localStorage.getItem("serverRoomConfig");
        if (savedConfig) {
            try {
                const parsed = JSON.parse(savedConfig);
                config.update((c) => ({ ...c, ...parsed }));
            } catch (e) {
                console.error("Failed to load config:", e);
            }
        }
    }

    async function saveConfig(): Promise<void> {
        isSaving = true;
        try {
            const configValue = get(config);

            // Save to localStorage
            localStorage.setItem("serverRoomConfig", JSON.stringify(configValue));

            // In a real implementation, this would also update the server-side config
            // via an API call to persist the settings

            // For now, we'll just show a success message
            savedMessage = "配置已保存！注意：部分设置需要重启服务才能生效。";
            setTimeout(() => {
                savedMessage = "";
            }, 3000);
        } catch (error) {
            console.error("Failed to save config:", error);
            savedMessage = "保存失败：" + (error as Error).message;
        } finally {
            isSaving = false;
        }
    }

    async function testConnection(): Promise<void> {
        isTesting = true;
        testResult = "正在测试连接...";

        try {
            const connection = getOpenClawConnection();
            if (!connection.isEnabled()) {
                testResult = "❌ AI Gateway 未启用";
                return;
            }

            if (!connection.isConnected()) {
                await connection.connect();
            }

            // Test with a simple chat completion
            const response = await connection.sendChatMessage({
                messages: [{ role: "user", content: "Hello, this is a test. Please respond with 'OK'." }],
                model: get(config).defaultModel,
            });

            if (response.content) {
                testResult = `✅ 连接成功！模型响应: ${response.content.substring(0, 100)}...`;
            } else {
                testResult = "❌ 连接失败：无响应内容";
            }
        } catch (error) {
            testResult = `❌ 连接失败: ${(error as Error).message}`;
        } finally {
            isTesting = false;
        }
    }

    function resetToDefaults(): void {
        config.set({
            anthropicApiKey: "",
            anthropicBaseUrl: "https://open.bigmodel.cn/api/anthropic",
            defaultModel: "glm-5",
            openaiApiKey: "",
            googleApiKey: "",
            httpProxy: "",
            httpsProxy: "",
            noProxy: "localhost,127.0.0.1,.cluster.local,.svc,10.96.0.0/12,10.0.0.3",
            gatewayEnabled: true,
            triggerPrefix: "@AI",
            timeout: "30000",
            maxTokens: "4096",
        });
        localStorage.removeItem("serverRoomConfig");
    }

    function exportConfig(): void {
        const configValue = get(config);
        const blob = new Blob([JSON.stringify(configValue, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workadventure-config.json";
        a.click();
        URL.revokeObjectURL(url);
    }

    function importConfig(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (!input.files?.length) return;

        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target?.result as string);
                config.update((c) => ({ ...c, ...imported }));
            } catch (error) {
                alert("导入失败：无效的配置文件");
            }
        };
        reader.readAsText(file);
    }

    onMount(() => {
        loadConfig();
    });
</script>

<div class="server-room-panel h-full flex flex-col">
    <!-- Header -->
    <div class="panel-header p-4 border-b border-white/10">
        <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
                <span class="text-2xl">🖥️</span>
                <h2 class="text-white font-semibold text-lg">机房配置</h2>
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
        <p class="text-white/50 text-xs mt-1">配置 AI Gateway、代理和系统设置</p>
    </div>

    <!-- Content -->
    <div class="panel-content flex-1 overflow-y-auto p-4 space-y-4">
        <!-- AI Provider Settings -->
        <div class="config-section">
            <h3 class="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <span>🤖</span>
                AI 提供商配置
            </h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-white/70 text-xs mb-1">默认模型</label>
                    <select
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                        bind:value={$config.defaultModel}
                    >
                        {#each availableModels as model}
                            <option value={model.value}>{model.label}</option>
                        {/each}
                    </select>
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">API Key (智谱/Anthropic)</label>
                    <input
                        type="password"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="sk-..."
                        bind:value={$config.anthropicApiKey}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">API Base URL</label>
                    <input
                        type="text"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                        bind:value={$config.anthropicBaseUrl}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">OpenAI API Key (可选)</label>
                    <input
                        type="password"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="sk-..."
                        bind:value={$config.openaiApiKey}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">Google API Key (可选)</label>
                    <input
                        type="password"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="AIza..."
                        bind:value={$config.googleApiKey}
                    />
                </div>
            </div>
        </div>

        <!-- Proxy Settings -->
        <div class="config-section">
            <h3 class="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <span>🌐</span>
                代理配置
            </h3>
            <div class="space-y-3">
                <div>
                    <label class="block text-white/70 text-xs mb-1">HTTP 代理</label>
                    <input
                        type="text"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="http://192.168.9.113:10808"
                        bind:value={$config.httpProxy}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">HTTPS 代理</label>
                    <input
                        type="text"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="http://192.168.9.113:10808"
                        bind:value={$config.httpsProxy}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">不使用代理的地址</label>
                    <input
                        type="text"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none font-mono"
                        placeholder="localhost,127.0.0.1,..."
                        bind:value={$config.noProxy}
                    />
                </div>
            </div>
        </div>

        <!-- Gateway Settings -->
        <div class="config-section">
            <h3 class="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <span>⚙️</span>
                Gateway 设置
            </h3>
            <div class="space-y-3">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        class="text-purple-500 rounded"
                        bind:checked={$config.gatewayEnabled}
                    />
                    <span class="text-white/80 text-sm">启用 AI Gateway</span>
                </label>
                <div>
                    <label class="block text-white/70 text-xs mb-1">触发前缀</label>
                    <input
                        type="text"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                        bind:value={$config.triggerPrefix}
                    />
                    <p class="text-white/30 text-xs mt-1">在聊天中输入此前缀触发 AI 响应</p>
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">超时时间 (ms)</label>
                    <input
                        type="number"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                        bind:value={$config.timeout}
                    />
                </div>
                <div>
                    <label class="block text-white/70 text-xs mb-1">最大 Token 数</label>
                    <input
                        type="number"
                        class="w-full px-3 py-2 rounded bg-white/5 border border-white/10 text-white text-sm focus:border-purple-500/50 outline-none"
                        bind:value={$config.maxTokens}
                    />
                </div>
            </div>
        </div>

        <!-- Test Connection -->
        <div class="config-section">
            <h3 class="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <span>🔧</span>
                连接测试
            </h3>
            <button
                class="w-full py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                on:click={testConnection}
                disabled={isTesting}
            >
                {#if isTesting}
                    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    测试中...
                {:else}
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    测试连接
                {/if}
            </button>
            {#if testResult}
                <div class="mt-3 p-3 rounded bg-white/5 text-sm text-white/80 whitespace-pre-wrap">
                    {testResult}
                </div>
            {/if}
        </div>

        <!-- Import/Export -->
        <div class="config-section">
            <h3 class="text-white font-medium text-sm mb-3 flex items-center gap-2">
                <span>📁</span>
                配置导入/导出
            </h3>
            <div class="flex gap-2">
                <button
                    class="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                    on:click={exportConfig}
                >
                    📤 导出配置
                </button>
                <label class="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors cursor-pointer text-center">
                    📥 导入配置
                    <input
                        type="file"
                        accept=".json"
                        class="hidden"
                        on:change={importConfig}
                    />
                </label>
            </div>
        </div>
    </div>

    <!-- Footer -->
    <div class="panel-footer p-4 border-t border-white/10">
        {#if savedMessage}
            <div class="mb-3 p-2 rounded bg-green-500/20 text-green-400 text-xs text-center">
                {savedMessage}
            </div>
        {/if}
        <div class="flex gap-2">
            <button
                class="flex-1 py-2.5 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                on:click={saveConfig}
                disabled={isSaving}
            >
                {#if isSaving}
                    保存中...
                {:else}
                    💾 保存配置
                {/if}
            </button>
            <button
                class="py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-colors"
                on:click={resetToDefaults}
            >
                重置
            </button>
        </div>
    </div>
</div>

<style lang="scss">
    .server-room-panel {
        background: linear-gradient(180deg, rgba(88, 28, 135, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
    }

    .config-section {
        padding: 12px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.05);
    }

    select {
        option {
            background: #1a1a2e;
            color: white;
        }
    }

    input[type="checkbox"] {
        &:checked {
            accent-color: #a855f7;
        }
    }
</style>
