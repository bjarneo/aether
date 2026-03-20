<script lang="ts">
    let {
        src,
        alt = '',
        open = false,
        onclose,
        onprev,
        onnext,
        hasPrev = false,
        hasNext = false,
    }: {
        src: string;
        alt?: string;
        open: boolean;
        onclose: () => void;
        onprev?: () => void;
        onnext?: () => void;
        hasPrev?: boolean;
        hasNext?: boolean;
    } = $props();

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') onclose();
        if (e.key === 'ArrowLeft' && hasPrev) onprev?.();
        if (e.key === 'ArrowRight' && hasNext) onnext?.();
    }
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8"
        onclick={e => {
            if (e.target === e.currentTarget) onclose();
        }}
        onkeydown={handleKeydown}
    >
        <!-- Close button -->
        <button
            class="text-fg-dimmed hover:text-fg-primary absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center transition-colors"
            onclick={onclose}
            aria-label="Close preview"
        >
            <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>

        <!-- Previous arrow -->
        {#if hasPrev}
            <button
                class="text-fg-dimmed hover:text-fg-primary absolute left-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-black/40 transition-colors hover:bg-black/60"
                onclick={onprev}
                aria-label="Previous image"
            >
                <svg
                    class="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
            </button>
        {/if}

        <!-- Next arrow -->
        {#if hasNext}
            <button
                class="text-fg-dimmed hover:text-fg-primary absolute right-3 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center bg-black/40 transition-colors hover:bg-black/60"
                onclick={onnext}
                aria-label="Next image"
            >
                <svg
                    class="h-6 w-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <polyline points="9 6 15 12 9 18"></polyline>
                </svg>
            </button>
        {/if}

        <img
            {src}
            {alt}
            class="max-h-full max-w-full object-contain shadow-2xl"
        />
    </div>
{/if}
