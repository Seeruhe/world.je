<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { get } from "svelte/store";
    import type { ChatRoom } from "../../Connection/ChatConnection";
    import type { OpenClawChatRoom } from "../../Connection/OpenClaw/OpenClawChatRoom";
    import { getOpenClawConnection } from "../../Connection/OpenClaw/OpenClawConnection";
    import { selectedRoomStore } from "../../Stores/SelectRoomStore";
    import Avatar from "../Avatar.svelte";
    import MessageInput from "../Room/MessageInput.svelte";
    import TypingUsers from "../Room/TypingUsers.svelte";
    import RoomTimeline from "../Room/RoomTimeline.svelte";
    import { IconSend, IconLoader } from "@wa-icons";

    export let room: OpenClawChatRoom;

    let message = "";
    let messageInputRef: HTMLDivElement;
    let isSending = false;
    let connection = getOpenClawConnection();
    let connectionState = connection.getConnectionState();

    // Scroll to bottom when new messages arrive
    let timelineContainer: HTMLDivElement;
    let shouldAutoScroll = true;

    $: messages = room.messages;
    $: typingMembers = room.typingMembers;
    $: isConnected = $connectionState === "connected";
    $: aiUser = room.getAIUser();
    $: chatRoom = room as unknown as ChatRoom;

    function scrollToBottom(smooth = false) {
        if (timelineContainer && shouldAutoScroll) {
            timelineContainer.scrollTo({
                top: timelineContainer.scrollHeight,
                behavior: smooth ? "smooth" : "auto",
            });
        }
    }

    function onTimelineScroll() {
        if (!timelineContainer) return;
        const { scrollTop, scrollHeight, clientHeight } = timelineContainer;
        // If we're within 100px of the bottom, enable auto-scroll
        shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100;
    }

    async function handleKeyDown(event: KeyboardEvent) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            await sendMessage();
        }
    }

    async function sendMessage() {
        const content = message.trim();
        if (!content || isSending) return;

        // Clear input immediately for better UX
        const messageToSend = content;
        message = "";
        if (messageInputRef) {
            messageInputRef.innerHTML = "";
        }

        isSending = true;
        try {
            await room.sendMessage(messageToSend);
            scrollToBottom(true);
        } catch (error) {
            console.error("Failed to send message:", error);
        } finally {
            isSending = false;
        }
    }

    function focusInput() {
        messageInputRef?.focus();
    }

    // Auto-scroll when messages change
    $: if (messages) {
        setTimeout(() => scrollToBottom(), 0);
    }

    onMount(() => {
        focusInput();
        // Connect to OpenClaw if not already connected
        if (connection.isEnabled() && !connection.isConnected()) {
            connection.connect().catch(console.error);
        }
    });
</script>

<div class="ai-chat-panel flex flex-col h-full">
    <!-- Header -->
    <div class="ai-chat-header flex items-center gap-3 p-4 border-b border-white/10">
        <div class="ai-avatar relative">
            <Avatar pictureStore={room.pictureStore} fallbackName={$room.name} />
            <div class="ai-badge absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-1">
                <!-- Robot icon SVG -->
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"/>
                </svg>
            </div>
        </div>
        <div class="flex-1">
            <h3 class="text-white font-semibold text-sm">{$room.name}</h3>
            <p class="text-white/50 text-xs">
                {#if $isConnected}
                    <span class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-green-400"></span>
                        Connected
                    </span>
                {:else if $connectionState === "connecting"}
                    <span class="flex items-center gap-1">
                        <IconLoader class="w-3 h-3 animate-spin" />
                        Connecting...
                    </span>
                {:else}
                    <span class="flex items-center gap-1">
                        <span class="w-2 h-2 rounded-full bg-red-400"></span>
                        Disconnected
                    </span>
                {/if}
            </p>
        </div>
    </div>

    <!-- Timeline -->
    <div
        bind:this={timelineContainer}
        class="ai-chat-timeline flex-1 overflow-y-auto p-4"
        on:scroll={onTimelineScroll}
    >
        <RoomTimeline room={chatRoom} />
    </div>

    <!-- Typing indicator -->
    {#if $typingMembers.length > 0}
        <div class="px-4 py-2">
            <TypingUsers typingMembers={$typingMembers} />
        </div>
    {/if}

    <!-- Input -->
    <div class="ai-chat-input p-4 border-t border-white/10">
        <div class="flex gap-2 items-end">
            <div class="flex-1 bg-white/5 rounded-lg border border-white/10 focus-within:border-purple-500/50">
                <MessageInput
                    bind:message
                    bind:messageInput={messageInputRef}
                    onKeyDown={handleKeyDown}
                    disabled={isSending || !$isConnected}
                    dataTestid="ai-message-input"
                    inputClass="message-input w-full min-h-[40px] max-h-[120px] p-3 text-white text-sm bg-transparent outline-none resize-none overflow-y-auto"
                    dataText="Message AI..."
                />
            </div>
            <button
                class="send-button p-3 rounded-lg bg-purple-500 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                on:click={sendMessage}
                disabled={isSending || !$isConnected || !message.trim()}
                data-testid="ai-send-button"
            >
                {#if isSending}
                    <IconLoader class="w-5 h-5 text-white animate-spin" />
                {:else}
                    <IconSend class="w-5 h-5 text-white" />
                {/if}
            </button>
        </div>
        <p class="text-white/30 text-xs mt-2">
            Press Enter to send, Shift+Enter for new line
        </p>
    </div>
</div>

<style lang="scss">
    .ai-chat-panel {
        background: linear-gradient(180deg, rgba(88, 28, 135, 0.1) 0%, rgba(0, 0, 0, 0.2) 100%);
    }

    .ai-chat-timeline {
        scroll-behavior: smooth;
    }

    .message-input:empty::before {
        content: attr(data-text);
        color: rgba(255, 255, 255, 0.3);
        pointer-events: none;
    }
</style>
