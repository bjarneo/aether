<script lang="ts">
    import {
        getToastMessage,
        getToastVisible,
        getToastAction,
    } from '$lib/stores/ui.svelte';

    // Force reactivity by reading in a derived-like pattern
    let visible = $derived(getToastVisible());
    let message = $derived(getToastMessage());
    let action = $derived(getToastAction());
</script>

{#if visible}
    <div
        class="border-border text-fg-primary fixed bottom-14 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 border bg-[#222228] px-4 py-2 text-[12px] shadow-lg"
        style="animation: toast-in 150ms ease-out"
    >
        <span>{message}</span>
        {#if action}
            <button
                class="text-accent hover:text-accent-hover -my-1 -mr-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors"
                onclick={() => action?.run()}
            >
                {action.label}
            </button>
        {/if}
    </div>
{/if}

<style>
    @keyframes toast-in {
        from {
            opacity: 0;
            transform: translateX(-50%) translateY(8px);
        }
        to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }
    }
</style>
