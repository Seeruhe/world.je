<script lang="ts">
    /**
     * AI Chat Room list item component
     * Displays an AI assistant room in the room list
     */
    import highlightWords from "highlight-words";
    import type { OpenClawChatRoom } from "../../Connection/OpenClaw/OpenClawChatRoom";
    import { chatSearchBarValue } from "../../Stores/ChatStore";
    import { selectedRoomStore } from "../../Stores/SelectRoomStore";
    import Avatar from "../Avatar.svelte";

    export let room: OpenClawChatRoom;

    let hasUnreadMessage = room.hasUnreadMessages;
    let roomName = room.name;

    $: chunks = highlightWords({
        text: $roomName,
        query: $chatSearchBarValue,
    });

    $: isSelected = $selectedRoomStore?.id === room.id;
</script>

<div
    class="ai-room-item group relative mb-[1px] text-md m-0 flex gap-2 flex-row items-center hover:bg-white transition-all hover:bg-opacity-10 hover:rounded hover:!cursor-pointer p-2 cursor-pointer w-full"
    class:bg-white={isSelected}
    class:bg-opacity-10={isSelected}
    class:rounded={isSelected}
    on:click={() => selectedRoomStore.set(room)}
    on:keyup={() => selectedRoomStore.set(room)}
    role="button"
    tabindex="0"
    data-testid="ai-room-{$roomName}"
>
    <div class="relative">
        <Avatar pictureStore={room.pictureStore} fallbackName={$roomName} />
        <div class="ai-badge absolute -bottom-1 -right-1 bg-purple-500 rounded-full p-0.5">
            <!-- Robot icon SVG -->
            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13A2.5 2.5 0 0 0 5 15.5A2.5 2.5 0 0 0 7.5 18a2.5 2.5 0 0 0 2.5-2.5A2.5 2.5 0 0 0 7.5 13m9 0a2.5 2.5 0 0 0-2.5 2.5a2.5 2.5 0 0 0 2.5 2.5a2.5 2.5 0 0 0 2.5-2.5a2.5 2.5 0 0 0-2.5-2.5Z"/>
            </svg>
        </div>
    </div>
    <div class="m-0 flex-1 text-start">
        {#each chunks as chunk (chunk.key)}
            <span
                class="{chunk.match ? 'text-light-blue' : ''} {$hasUnreadMessage
                    ? 'text-white font-bold'
                    : 'text-white/75'} cursor-default text-sm flex items-center gap-1"
            >
                {chunk.text}
            </span>
        {/each}
    </div>
    {#if $hasUnreadMessage}
        <div class="flex items-center justify-center h-7 w-7 relative">
            <div class="rounded-full bg-purple-400 h-2 w-2 animate-ping absolute" />
            <div class="rounded-full bg-purple-400 h-1.5 w-1.5 absolute" />
        </div>
    {/if}
</div>
