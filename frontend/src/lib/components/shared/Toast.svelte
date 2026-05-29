<script lang="ts">
    import {
        getToastMessage,
        getToastVisible,
        getToastAction,
        getToastQueueDepth,
        dismissCurrentToast,
    } from '$lib/stores/ui.svelte';
    import CloseIcon from '$lib/components/shared/CloseIcon.svelte';

    let visible = $derived(getToastVisible());
    let message = $derived(getToastMessage());
    let action = $derived(getToastAction());
    let queueDepth = $derived(getToastQueueDepth());

    function runAction() {
        action?.run();
        dismissCurrentToast();
    }
</script>

{#if visible}
    <div
        class="border-border bg-bg-elevated text-fg-primary fixed bottom-14 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-3 border px-4 py-2 text-[12px] shadow-lg"
        style="animation: toast-in 150ms ease-out"
        role="status"
        aria-live="polite"
    >
        <span>{message}</span>
        {#if queueDepth > 1}
            <span class="text-fg-dimmed font-mono text-[10px] tabular-nums"
                >+{queueDepth - 1}</span
            >
        {/if}
        {#if action}
            <button
                type="button"
                class="text-accent hover:text-accent-hover -my-1 px-2 py-1 text-[11px] font-medium uppercase tracking-wide transition-colors"
                onclick={runAction}
            >
                {action.label}
            </button>
        {/if}
        <button
            type="button"
            class="text-fg-dimmed hover:text-fg-primary -my-1 -mr-2 flex h-7 w-7 items-center justify-center transition-colors"
            onclick={dismissCurrentToast}
            aria-label="Dismiss"
            title="Dismiss"
        >
            <CloseIcon size="h-3.5 w-3.5" />
        </button>
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
