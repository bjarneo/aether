<script lang="ts">
    import type {Snippet} from 'svelte';

    let {
        open,
        onclose,
        panelClass = 'w-80',
        z = 'z-50',
        children,
    }: {
        open: boolean;
        onclose: () => void;
        panelClass?: string;
        z?: string;
        children: Snippet;
    } = $props();

    $effect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onclose();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
    <div
        class="fixed inset-0 {z} flex items-center justify-center bg-black/45"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        role="presentation"
    >
        <div
            class="bg-bg-secondary border-border {panelClass} max-w-[90vw] border p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
        >
            {@render children()}
        </div>
    </div>
{/if}
