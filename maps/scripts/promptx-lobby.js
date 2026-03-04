/**
 * PromptX AI Hub Room Script
 * 房间交互逻辑脚本
 */

// 房间初始化
WA.onInit().then(() => {
    console.log('PromptX AI Hub initialized');

    // 显示欢迎消息
    WA.ui.displayBubbleMessage({
        type: "message",
        message: "Welcome to PromptX AI Hub! 🤖\nExplore AI skills and interact with smart NPCs.",
        scope: "local",
    });

    // 监听区域进入事件
    WA.room.onEnterLayer("skills-demo-zone").subscribe(() => {
        WA.ui.displayBubbleMessage({
            type: "message",
            message: "You've entered the Skills Demo Zone! Click on terminals to try AI skills.",
            scope: "local",
        });
    });

    WA.room.onEnterLayer("ai-lab-zone").subscribe(() => {
        // 检查权限
        WA.player.tags.then(tags => {
            if (!tags.includes('developer') && !tags.includes('admin')) {
                WA.ui.displayBubbleMessage({
                    type: "warning",
                    message: "⚠️ Restricted Area: Developer role required",
                    scope: "local",
                });
            } else {
                WA.ui.displayBubbleMessage({
                    type: "message",
                    message: "🔓 AI Lab access granted. High-risk skills enabled.",
                    scope: "local",
                });
            }
        });
    });

    // 监听终端交互
    WA.room.onEnterLayer("terminal-interaction").subscribe(() => {
        WA.ui.actionBar.addButton({
            id: "open-skills",
            label: "🤖 AI Skills",
            callback: () => {
                // 打开技能面板
                WA.nav.openCoWebSite("http://play.world.je.localhost/skills", true);
            }
        });
    });

    WA.room.onLeaveLayer("terminal-interaction").subscribe(() => {
        WA.ui.actionBar.removeButton("open-skills");
    });

    // NPC 交互监听
    WA.room.onEnterLayer("npc-guide-zone").subscribe(() => {
        WA.ui.actionBar.addButton({
            id: "talk-guide",
            label: "💬 Chat with 小普",
            callback: () => {
                startNPCChat("npc-guide");
            }
        });
    });

    WA.room.onLeaveLayer("npc-guide-zone").subscribe(() => {
        WA.ui.actionBar.removeButton("talk-guide");
    });

    // 注册事件追踪
    WA.event.on("skill.use.requested").subscribe((event) => {
        console.log("Skill use requested:", event);
        trackEvent("skill_use", {
            skillId: event.skillId,
            userId: WA.player.id,
            roomId: WA.room.id
        });
    });

    WA.event.on("skill.use.completed").subscribe((event) => {
        console.log("Skill use completed:", event);
        // 显示成功消息
        WA.chat.sendChatMessage(`✅ Skill ${event.skillId} executed successfully!`, "System");
    });

    WA.event.on("skill.use.failed").subscribe((event) => {
        console.log("Skill use failed:", event);
        // 显示错误消息
        WA.chat.sendChatMessage(`❌ Skill ${event.skillId} failed: ${event.error}`, "System");
    });
});

// NPC 聊天功能
async function startNPCChat(npcId) {
    const npcConfigs = {
        "npc-guide": {
            name: "小普",
            personality: "friendly",
            systemPrompt: "你是 PromptX AI Hub 的向导小普。你的职责是帮助访客了解这个空间的功能。"
        },
        "npc-developer": {
            name: "码大师",
            personality: "expert",
            systemPrompt: "你是 PromptX AI Hub 的技术顾问码大师。你精通各种编程技术。"
        }
    };

    const npc = npcConfigs[npcId];
    if (!npc) return;

    // 打开聊天窗口
    WA.nav.openCoWebWebsite({
        url: `http://play.world.je.localhost/npc-chat/${npcId}`,
        allowApi: true,
        allowPolicy: "same-origin"
    });
}

// 事件追踪
function trackEvent(eventName, data) {
    // 发送到后端进行记录
    WA.player.state.saveVariable("lastEvent", {
        name: eventName,
        data: data,
        timestamp: Date.now()
    }, true);
}

// 命令注册
WA.registerCommand({
    name: "skill",
    description: "Execute an AI skill",
    parameters: [
        { name: "skillId", type: "string", required: true },
        { name: "params", type: "json", required: false }
    ],
    handler: (args) => {
        executeSkill(args.skillId, args.params || {});
    }
});

WA.registerCommand({
    name: "help",
    description: "Show available commands and skills",
    handler: () => {
        WA.chat.sendChatMessage(
            "📚 Available Commands:\n" +
            "/skill <skillId> - Execute an AI skill\n" +
            "/help - Show this help\n\n" +
            "🎯 Available Skills:\n" +
            "- skill-ai-translate\n" +
            "- skill-ai-summarize\n" +
            "- skill-code-exec\n" +
            "- skill-npc-chat",
            "Help"
        );
    }
});

// 技能执行
async function executeSkill(skillId, params) {
    try {
        const result = await WA.player.state.saveVariable("skillExecution", {
            skillId: skillId,
            params: params,
            status: "pending",
            timestamp: Date.now()
        }, true);

        WA.chat.sendChatMessage(`🚀 Executing skill: ${skillId}...`, "System");
    } catch (error) {
        WA.chat.sendChatMessage(`❌ Failed to execute skill: ${error.message}`, "Error");
    }
}
