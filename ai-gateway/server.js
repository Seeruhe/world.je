/**
 * AI Gateway for WorkAdventure
 * WebSocket 网关，连接到智谱 AI (GLM) 的 Anthropic 兼容接口
 * 同时支持 Skills 和 Targets 管理
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.OPENCLAW_PORT || 18789;
const HOST = process.env.OPENCLAW_HOST || '0.0.0.0';

// 智谱 AI 配置
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://open.bigmodel.cn/api/anthropic';
const DEFAULT_MODEL = process.env.OPENCLAW_DEFAULT_MODEL || 'glm-5';

console.log('AI Gateway starting...');
console.log('Port:', PORT);
console.log('Model:', DEFAULT_MODEL);
console.log('Base URL:', ANTHROPIC_BASE_URL);
console.log('API Key:', ANTHROPIC_API_KEY ? 'configured' : 'missing');

// ============================================================================
// Skills and Targets Registry
// ============================================================================

// Load registries
const skillsRegistryPath = path.join(__dirname, 'skills-registry.json');
const targetsRegistryPath = path.join(__dirname, 'targets-registry.json');

let skillsRegistry = { version: '1.0.0', categories: [], skills: [] };
let targetsRegistry = { version: '1.0.0', targets: [] };

function loadRegistries() {
    try {
        if (fs.existsSync(skillsRegistryPath)) {
            skillsRegistry = JSON.parse(fs.readFileSync(skillsRegistryPath, 'utf8'));
            console.log(`Loaded ${skillsRegistry.skills?.length || 0} skills from registry`);
        }
    } catch (error) {
        console.error('Failed to load skills registry:', error.message);
    }

    try {
        if (fs.existsSync(targetsRegistryPath)) {
            targetsRegistry = JSON.parse(fs.readFileSync(targetsRegistryPath, 'utf8'));
            console.log(`Loaded ${targetsRegistry.targets?.length || 0} targets from registry`);
        }
    } catch (error) {
        console.error('Failed to load targets registry:', error.message);
    }
}

function saveSkillsRegistry() {
    try {
        fs.writeFileSync(skillsRegistryPath, JSON.stringify(skillsRegistry, null, 2));
    } catch (error) {
        console.error('Failed to save skills registry:', error.message);
    }
}

function saveTargetsRegistry() {
    try {
        fs.writeFileSync(targetsRegistryPath, JSON.stringify(targetsRegistry, null, 2));
    } catch (error) {
        console.error('Failed to save targets registry:', error.message);
    }
}

// Load registries on startup
loadRegistries();

// Track installed skills (in-memory for now, could persist to DB)
const installedSkills = new Map();

// Track active executions
const activeExecutions = new Map();

// ============================================================================
// WebSocket Server
// ============================================================================

const wss = new WebSocket.Server({ host: HOST, port: PORT });

// 解析 Base URL
const baseUrlObj = new URL(ANTHROPIC_BASE_URL);
const isHttps = baseUrlObj.protocol === 'https:';
const httpClient = isHttps ? https : http;

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());
            console.log('Received:', message.type, message.requestId);

            // Route to appropriate handler
            switch (message.type) {
                case 'ping':
                    handlePing(ws, message);
                    break;

                case 'chat.completion':
                    await handleChatCompletion(ws, message);
                    break;

                // Skills handlers
                case 'skills.list':
                    handleSkillsList(ws, message);
                    break;

                case 'skills.info':
                    handleSkillsInfo(ws, message);
                    break;

                case 'skills.install':
                    await handleSkillsInstall(ws, message);
                    break;

                case 'skills.uninstall':
                    await handleSkillsUninstall(ws, message);
                    break;

                case 'skills.execute':
                    await handleSkillsExecute(ws, message);
                    break;

                case 'skills.categories':
                    handleSkillsCategories(ws, message);
                    break;

                // Targets handlers
                case 'targets.list':
                    handleTargetsList(ws, message);
                    break;

                case 'targets.register':
                    handleTargetsRegister(ws, message);
                    break;

                case 'targets.unregister':
                    handleTargetsUnregister(ws, message);
                    break;

                case 'targets.status':
                    await handleTargetsStatus(ws, message);
                    break;

                default:
                    sendError(ws, message.requestId, 'Unknown message type: ' + message.type);
            }
        } catch (error) {
            console.error('Parse error:', error.message);
            try {
                const parsed = JSON.parse(data.toString());
                sendError(ws, parsed.requestId, 'Error processing request: ' + error.message);
            } catch (e) {
                // Ignore if can't parse
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
    });
});

// ============================================================================
// Message Handlers
// ============================================================================

function handlePing(ws, message) {
    ws.send(JSON.stringify({ type: 'pong', requestId: message.requestId }));
}

async function handleChatCompletion(ws, message) {
    const { messages, model } = message.payload;
    const useModel = model || DEFAULT_MODEL;

    try {
        const response = await callAnthropicAPI(messages, useModel);
        ws.send(JSON.stringify({
            requestId: message.requestId,
            payload: {
                id: 'chat-' + Date.now(),
                sessionId: message.requestId,
                content: response,
                model: useModel
            }
        }));
    } catch (error) {
        console.error('API Error:', error.message);
        sendError(ws, message.requestId, error.message);
    }
}

// ============================================================================
// Skills Handlers
// ============================================================================

function handleSkillsList(ws, message) {
    const { category, installed } = message.payload || {};

    let skills = skillsRegistry.skills || [];

    // Filter by category if provided
    if (category) {
        skills = skills.filter(s => s.category === category);
    }

    // Filter by installed status if provided
    if (installed !== undefined) {
        skills = skills.filter(s => s.installed === installed);
    }

    // Update installed status from our tracking
    skills = skills.map(skill => ({
        ...skill,
        installed: installedSkills.has(skill.id) || skill.installed
    }));

    sendResponse(ws, message.requestId, {
        skills,
        categories: skillsRegistry.categories || []
    });
}

function handleSkillsInfo(ws, message) {
    const { skillId } = message.payload || {};

    const skill = skillsRegistry.skills?.find(s => s.id === skillId);

    if (!skill) {
        sendError(ws, message.requestId, 'Skill not found: ' + skillId);
        return;
    }

    sendResponse(ws, message.requestId, {
        skill: {
            ...skill,
            installed: installedSkills.has(skill.id) || skill.installed
        }
    });
}

async function handleSkillsInstall(ws, message) {
    const { skillId, version, userConfig, targetBindings, grantedPermissions } = message.payload || {};

    const skill = skillsRegistry.skills?.find(s => s.id === skillId);

    if (!skill) {
        sendError(ws, message.requestId, 'Skill not found: ' + skillId);
        return;
    }

    try {
        // Simulate installation (in real implementation, would call npm or setup MCP)
        const installPath = `/opt/openclaw/skills/${skillId}`;

        // Store installation info
        installedSkills.set(skillId, {
            skillId,
            version: version || skill.version,
            installPath,
            userConfig: userConfig || {},
            targetBindings: targetBindings || [],
            grantedPermissions: grantedPermissions || [],
            installedAt: Date.now()
        });

        // Update registry
        const skillIndex = skillsRegistry.skills.findIndex(s => s.id === skillId);
        if (skillIndex !== -1) {
            skillsRegistry.skills[skillIndex].installed = true;
            skillsRegistry.skills[skillIndex].installPath = installPath;
            saveSkillsRegistry();
        }

        sendResponse(ws, message.requestId, {
            skill: {
                ...skill,
                installed: true,
                installPath
            },
            installPath,
            success: true,
            message: `Skill ${skillId} installed successfully`
        });
    } catch (error) {
        sendError(ws, message.requestId, 'Installation failed: ' + error.message);
    }
}

async function handleSkillsUninstall(ws, message) {
    const { skillId } = message.payload || {};

    if (!installedSkills.has(skillId)) {
        sendError(ws, message.requestId, 'Skill not installed: ' + skillId);
        return;
    }

    try {
        // Remove from tracking
        installedSkills.delete(skillId);

        // Update registry
        const skillIndex = skillsRegistry.skills.findIndex(s => s.id === skillId);
        if (skillIndex !== -1) {
            skillsRegistry.skills[skillIndex].installed = false;
            delete skillsRegistry.skills[skillIndex].installPath;
            saveSkillsRegistry();
        }

        sendResponse(ws, message.requestId, {
            skillId,
            success: true,
            message: `Skill ${skillId} uninstalled successfully`
        });
    } catch (error) {
        sendError(ws, message.requestId, 'Uninstallation failed: ' + error.message);
    }
}

async function handleSkillsExecute(ws, message) {
    const { skillId, targetId, parameters, sessionId, executionMode } = message.payload || {};

    const skill = skillsRegistry.skills?.find(s => s.id === skillId);

    if (!skill) {
        sendError(ws, message.requestId, 'Skill not found: ' + skillId);
        return;
    }

    if (!installedSkills.has(skillId) && !skill.installed) {
        sendError(ws, message.requestId, 'Skill not installed: ' + skillId);
        return;
    }

    const executionId = uuidv4();
    const startTime = Date.now();

    try {
        // Track execution
        activeExecutions.set(executionId, {
            executionId,
            skillId,
            targetId,
            status: 'running',
            startTime
        });

        // Send running status
        sendResponse(ws, message.requestId, {
            executionId,
            status: 'running',
            targetId,
            logs: [`Starting execution of skill ${skillId}...`]
        });

        // Simulate skill execution (in real implementation, would call actual skill)
        // For now, return a mock response
        const output = await simulateSkillExecution(skill, parameters, targetId);

        const executionTime = Date.now() - startTime;
        activeExecutions.delete(executionId);

        sendResponse(ws, message.requestId, {
            executionId,
            status: 'completed',
            output,
            executionTime,
            targetId,
            logs: [`Skill ${skillId} executed successfully in ${executionTime}ms`]
        });
    } catch (error) {
        activeExecutions.delete(executionId);

        sendResponse(ws, message.requestId, {
            executionId,
            status: 'failed',
            error: error.message,
            executionTime: Date.now() - startTime,
            targetId,
            logs: [`Error executing skill ${skillId}: ${error.message}`]
        });
    }
}

function handleSkillsCategories(ws, message) {
    sendResponse(ws, message.requestId, {
        categories: skillsRegistry.categories || []
    });
}

// ============================================================================
// Targets Handlers
// ============================================================================

function handleTargetsList(ws, message) {
    const { type, status } = message.payload || {};

    let targets = targetsRegistry.targets || [];

    // Filter by type if provided
    if (type) {
        targets = targets.filter(t => t.type === type);
    }

    // Filter by status if provided
    if (status) {
        targets = targets.filter(t => t.status === status);
    }

    sendResponse(ws, message.requestId, {
        targets
    });
}

function handleTargetsRegister(ws, message) {
    const { name, type, icon, description, config } = message.payload || {};

    if (!name || !type) {
        sendError(ws, message.requestId, 'Name and type are required');
        return;
    }

    const targetId = `target-${uuidv4()}`;

    const newTarget = {
        id: targetId,
        name,
        type,
        icon: icon || getDefaultIcon(type),
        description: description || '',
        config: config || {},
        status: 'unknown',
        boundSkills: []
    };

    targetsRegistry.targets.push(newTarget);
    saveTargetsRegistry();

    sendResponse(ws, message.requestId, {
        target: newTarget,
        success: true,
        message: `Target ${name} registered successfully`
    });
}

function handleTargetsUnregister(ws, message) {
    const { targetId } = message.payload || {};

    const targetIndex = targetsRegistry.targets.findIndex(t => t.id === targetId);

    if (targetIndex === -1) {
        sendError(ws, message.requestId, 'Target not found: ' + targetId);
        return;
    }

    targetsRegistry.targets.splice(targetIndex, 1);
    saveTargetsRegistry();

    sendResponse(ws, message.requestId, {
        targetId,
        success: true,
        message: 'Target unregistered successfully'
    });
}

async function handleTargetsStatus(ws, message) {
    const { targetId } = message.payload || {};

    if (targetId) {
        // Check specific target
        const target = targetsRegistry.targets.find(t => t.id === targetId);

        if (!target) {
            sendError(ws, message.requestId, 'Target not found: ' + targetId);
            return;
        }

        // Simulate status check (in real implementation, would ping the target)
        const status = await checkTargetStatus(target);
        target.status = status;
        saveTargetsRegistry();

        sendResponse(ws, message.requestId, {
            targetId,
            status,
            lastChecked: Date.now()
        });
    } else {
        // Check all targets
        const results = [];

        for (const target of targetsRegistry.targets) {
            const status = await checkTargetStatus(target);
            target.status = status;
            results.push({
                targetId: target.id,
                status,
                lastChecked: Date.now()
            });
        }

        saveTargetsRegistry();

        sendResponse(ws, message.requestId, {
            targets: results
        });
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

function sendResponse(ws, requestId, payload) {
    ws.send(JSON.stringify({
        requestId,
        payload
    }));
}

function sendError(ws, requestId, error) {
    ws.send(JSON.stringify({
        requestId,
        payload: { error }
    }));
}

/**
 * 调用智谱 AI 的 Anthropic 兼容接口
 */
async function callAnthropicAPI(messages, model) {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify({
            model: model,
            max_tokens: 4096,
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            }))
        });

        const options = {
            hostname: baseUrlObj.hostname,
            port: baseUrlObj.port || (isHttps ? 443 : 80),
            path: '/v1/messages',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            }
        };

        const req = httpClient.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.error) {
                        reject(new Error(response.error.message || JSON.stringify(response.error)));
                    } else if (response.content && response.content[0]) {
                        resolve(response.content[0].text);
                    } else {
                        reject(new Error('Invalid response format: ' + data.substring(0, 200)));
                    }
                } catch (error) {
                    reject(new Error('Parse error: ' + data.substring(0, 200)));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(requestBody);
        req.end();
    });
}

/**
 * Simulate skill execution (placeholder for real implementation)
 */
async function simulateSkillExecution(skill, parameters, targetId) {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock result based on skill type
    switch (skill.type) {
        case 'npm':
            return {
                success: true,
                message: `Executed ${skill.npmPackage} with parameters`,
                parameters,
                targetId
            };

        case 'mcp':
            return {
                success: true,
                message: `Executed MCP server ${skill.mcpConfig?.command}`,
                parameters,
                targetId
            };

        case 'script':
            return {
                success: true,
                message: `Executed script from ${skill.scriptUrl}`,
                parameters,
                targetId
            };

        case 'project':
            return {
                success: true,
                message: `Executed project from ${skill.projectConfig?.repoUrl}`,
                parameters,
                targetId
            };

        case 'api':
            return {
                success: true,
                message: `Called API at ${skill.apiConfig?.baseUrl}`,
                parameters,
                targetId
            };

        default:
            return {
                success: true,
                message: 'Skill executed',
                parameters,
                targetId
            };
    }
}

/**
 * Check target status (placeholder for real implementation)
 */
async function checkTargetStatus(target) {
    // Simulate status check
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock status based on target type
    switch (target.type) {
        case 'device':
            // In real implementation, would ping the device
            return 'online';

        case 'virtual-area':
            // Virtual areas are always "online" if they exist
            return 'online';

        case 'external-api':
            // In real implementation, would make a health check request
            return 'online';

        case 'open-project':
            // In real implementation, would check if repo is accessible
            return 'online';

        default:
            return 'unknown';
    }
}

/**
 * Get default icon for target type
 */
function getDefaultIcon(type) {
    const icons = {
        'device': 'computer',
        'virtual-area': 'map',
        'external-api': 'api',
        'open-project': 'github'
    };
    return icons[type] || 'target';
}

// ============================================================================
// Health Check Server
// ============================================================================

const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            version: '1.0.0',
            skills: skillsRegistry.skills?.length || 0,
            targets: targetsRegistry.targets?.length || 0,
            uptime: process.uptime()
        }));
    } else if (req.url === '/stats') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            skills: {
                total: skillsRegistry.skills?.length || 0,
                installed: installedSkills.size
            },
            targets: {
                total: targetsRegistry.targets?.length || 0,
                online: targetsRegistry.targets?.filter(t => t.status === 'online').length || 0
            },
            executions: {
                active: activeExecutions.size
            }
        }));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

healthServer.listen(18790, HOST, () => {
    console.log('Health check server listening on port 18790');
});

wss.on('listening', () => {
    console.log(`AI Gateway WebSocket server listening on ws://${HOST}:${PORT}`);
});

console.log('AI Gateway started successfully');
