/**
 * AI Gateway for WorkAdventure
 * 简单的 WebSocket 网关，连接到智谱 AI (GLM) 的 Anthropic 兼容接口
 */

const WebSocket = require('ws');
const https = require('https');
const http = require('http');

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

            // 处理 ping
            if (message.type === 'ping') {
                ws.send(JSON.stringify({ type: 'pong', requestId: message.requestId }));
                return;
            }

            // 处理聊天请求
            if (message.type === 'chat.completion') {
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
                    ws.send(JSON.stringify({
                        requestId: message.requestId,
                        payload: {
                            error: error.message
                        }
                    }));
                }
                return;
            }

            // 未知消息类型
            ws.send(JSON.stringify({
                requestId: message.requestId,
                payload: { error: 'Unknown message type: ' + message.type }
            }));

        } catch (error) {
            console.error('Parse error:', error.message);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
    });
});

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

// Health check endpoint
const healthServer = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
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
