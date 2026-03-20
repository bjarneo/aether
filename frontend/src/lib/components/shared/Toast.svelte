<script lang="ts">
    import {getToastMessage, getToastVisible} from '$lib/stores/ui.svelte';

    // Force reactivity by reading in a derived-like pattern
    let visible = $derived(getToastVisible());
    let message = $derived(getToastMessage());
</script>

{#if visible}
    <div
        class="border-border text-fg-primary fixed bottom-14 left-1/2 z-[100] -translate-x-1/2 border bg-[#222228] px-4 py-2 text-[12px] shadow-lg"
        style="animation: toast-in 150ms ease-out"
    >
        {message}
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
