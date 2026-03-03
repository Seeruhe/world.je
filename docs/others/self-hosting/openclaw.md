# OpenClaw AI Integration for WorkAdventure

This document describes how to set up and configure the OpenClaw AI integration in WorkAdventure.

## Overview

OpenClaw is a self-hosted AI gateway that enables AI-powered features in WorkAdventure:

- **AI Chat Assistant**: Users can interact with an AI assistant by typing `@AI` followed by their message
- **AI NPCs**: Map designers can place AI-driven NPCs that can hold conversations with users

## Architecture

```
WorkAdventure                          OpenClaw Gateway
┌─────────────────┐                   ┌──────────────────┐
│  play/src/Chat/ │                   │  ws://127.0.0.1  │
│  Connection/    │◄─────────────────►│  :18789          │
│  OpenClaw/      │    WebSocket      │                  │
└─────────────────┘                   │  Pi Agent (RPC)  │
                                      │  Claude/GPT/GLM  │
                                      └──────────────────┘
```

## Prerequisites

- Node.js 22+ (for OpenClaw Gateway)
- API key for your preferred LLM provider (Anthropic, OpenAI, Google, etc.)
- Docker and Docker Compose (recommended)

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and configure OpenClaw settings:

```bash
cp .env.template .env
```

Edit `.env` and set the following variables:

```bash
# OpenClaw AI Gateway Settings
OPENCLAW_ENABLED=true
OPENCLAW_GATEWAY_URL=ws://openclaw-gateway:18789
OPENCLAW_API_KEY=your-gateway-api-key
OPENCLAW_DEFAULT_MODEL=anthropic/claude-opus-4-6
OPENCLAW_TRIGGER_PREFIX=@AI

# LLM Provider API Keys (for OpenClaw Gateway)
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key
```

### 2. Start Services

Using Docker Compose:

```bash
# Start OpenClaw Gateway with WorkAdventure
docker-compose -f docker-compose.yaml -f docker-compose.openclaw.yaml up -d
```

Or manually install OpenClaw:

```bash
npm install -g @anthropic-ai/openclaw
openclaw gateway --port 18789
```

### 3. Verify Installation

Check the OpenClaw health endpoint:

```bash
curl http://localhost:18789/health
```

Or check via WorkAdventure API:

```bash
curl http://api.workadventure.localhost/health/openclaw
```

## Features

### AI Chat Assistant

Users can interact with the AI assistant in the chat by prefixing their message with `@AI`:

```
@AI What are some good icebreaker questions for a team meeting?
```

### AI NPCs

Place AI NPCs in your map using the map editor:

1. Open the map editor
2. Add an entity with the following properties:
   - `type`: `aiNpcPropertyData`
   - `name`: NPC display name
   - `personality`: NPC personality description
   - `systemPrompt`: Custom system prompt (optional)
   - `model`: Model override (optional)
   - `triggerDistance`: Interaction distance in pixels (default: 64)
   - `greetingMessage`: Initial greeting (optional)

Example NPC configuration:

```json
{
  "type": "aiNpcPropertyData",
  "name": "Guide",
  "personality": "a friendly virtual world guide who helps visitors navigate the space",
  "triggerDistance": 64,
  "greetingMessage": "Hello! I'm here to help you explore. Click on me to chat!"
}
```

## Configuration Reference

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_ENABLED` | Enable/disable OpenClaw integration | `false` |
| `OPENCLAW_GATEWAY_URL` | WebSocket URL for OpenClaw Gateway | `ws://127.0.0.1:18789` |
| `OPENCLAW_API_KEY` | API key for gateway authentication | (none) |
| `OPENCLAW_DEFAULT_MODEL` | Default AI model to use | `anthropic/claude-opus-4-6` |
| `OPENCLAW_TRIGGER_PREFIX` | Prefix to trigger AI in chat | `@AI` |

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/openclaw/chat` | POST | Send chat message to AI |
| `/health/openclaw` | GET | Health check for OpenClaw service |
| `/api/openclaw/sessions/:sessionId` | GET | Get session info |
| `/api/openclaw/sessions/:sessionId` | DELETE | Close a session |
| `/api/openclaw/sessions/user/:userId` | GET | Get user's sessions |

## Troubleshooting

### Connection Issues

1. Check that OpenClaw Gateway is running:
   ```bash
   docker ps | grep openclaw
   ```

2. Check gateway logs:
   ```bash
   docker logs workadventure-openclaw
   ```

3. Verify network connectivity:
   ```bash
   docker exec workadventure-back wget -q -O- http://openclaw-gateway:18789/health
   ```

### API Key Issues

Ensure your LLM provider API keys are correctly set:

```bash
# Check environment variables in container
docker exec workadventure-openclaw env | grep API_KEY
```

### Performance Issues

If experiencing slow responses:

1. Consider using a smaller/faster model
2. Adjust `maxTokens` in requests
3. Check network latency between services

## Security Considerations

- Keep API keys secure and never commit them to version control
- Use environment variables or secrets management
- Consider rate limiting for production deployments
- Review AI responses before displaying to users
- Implement content moderation as needed

## Further Reading

- [OpenClaw Documentation](https://github.com/anthropics/openclaw)
- [WorkAdventure Documentation](https://docs.workadventu.re)
- [AI Safety Best Practices](https://www.anthropic.com/ai-safety)
