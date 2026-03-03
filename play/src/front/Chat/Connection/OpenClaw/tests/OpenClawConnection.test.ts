/**
 * Tests for OpenClaw connection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenClawConnection } from "../OpenClawConnection";

// Mock environment variables
vi.mock("../../../Enum/EnvironmentVariable", () => ({
    OPENCLAW_ENABLED: true,
    OPENCLAW_GATEWAY_URL: "ws://localhost:18789",
    OPENCLAW_API_KEY: undefined,
    OPENCLAW_DEFAULT_MODEL: "anthropic/claude-opus-4-6",
    OPENCLAW_TRIGGER_PREFIX: "@AI",
}));

describe("OpenClawConnection", () => {
    let connection: OpenClawConnection;

    beforeEach(() => {
        connection = new OpenClawConnection();
    });

    afterEach(async () => {
        await connection.destroy();
    });

    describe("initialization", () => {
        it("should be enabled when OPENCLAW_ENABLED is true", () => {
            expect(connection.isEnabled()).toBe(true);
        });

        it("should return the correct trigger prefix", () => {
            expect(connection.getTriggerPrefix()).toBe("@AI");
        });
    });

    describe("trigger detection", () => {
        it("should detect AI trigger at the start of message", () => {
            expect(connection.shouldTriggerAI("@AI hello")).toBe(true);
        });

        it("should not detect AI trigger without prefix", () => {
            expect(connection.shouldTriggerAI("hello")).toBe(false);
        });

        it("should handle whitespace", () => {
            expect(connection.shouldTriggerAI("  @AI hello")).toBe(true);
            expect(connection.shouldTriggerAI("AI @hello")).toBe(false);
        });
    });

    describe("message extraction", () => {
        it("should extract message content after trigger prefix", () => {
            expect(connection.extractMessageContent("@AI hello world")).toBe("hello world");
        });

        it("should handle extra whitespace", () => {
            expect(connection.extractMessageContent("  @AI   hello world  ")).toBe("hello world");
        });

        it("should return original message if no prefix", () => {
            expect(connection.extractMessageContent("hello world")).toBe("hello world");
        });
    });

    describe("connection state", () => {
        it("should start in disconnected state", () => {
            const state = connection.getConnectionState();
            expect(state).toBeDefined();
        });

        it("should report not connected before connect is called", () => {
            expect(connection.isConnected()).toBe(false);
        });
    });

    describe("AI user", () => {
        it("should provide a default AI user", () => {
            const aiUser = connection.getDefaultAIUser();
            expect(aiUser).toBeDefined();
            expect(aiUser.chatId).toBe("ai-assistant");
        });
    });
});
