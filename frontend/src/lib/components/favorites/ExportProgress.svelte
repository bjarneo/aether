<script lang="ts">
    import {
        getExportState,
        cancelExport,
    } from '$lib/stores/favoritesExport.svelte';

    let state = $derived(getExportState());
    let percent = $derived(
        state.total > 0
            ? Math.min(100, Math.round((state.index / state.total) * 100))
            : 0
    );
    let label = $derived(
        state.phase === 'archive' ? 'Archiving' : 'Downloading'
    );
</script>

{#if state.active}
    <!--
      Sits directly above the ActionBar footer (h-10). App chrome, not an image
      overlay, so it uses theme tokens and stays legible in light mode.
    -->
    <div
        class="bg-bg-secondary border-border fixed bottom-10 left-0 right-0 z-[90] border-t"
    >
        <div class="flex items-center gap-3 px-3 py-1.5">
            <span class="text-fg-secondary shrink-0 text-[11px]">
                {label}
                {#if state.total > 0}{state.index}/{state.total}{/if}
            </span>
            {#if state.name}
                <span class="text-fg-dimmed min-w-0 flex-1 truncate text-[11px]"
                    >{state.name}</span
                >
            {:else}
                <span class="min-w-0 flex-1"></span>
            {/if}
            <button
                class="text-destructive/60 hover:text-destructive hover:bg-bg-hover shrink-0 px-2 py-1 text-[11px] transition-colors duration-100"
                onclick={cancelExport}>Cancel</button
            >
        </div>
        <div
            class="bg-bg-surface h-1 w-full"
            role="progressbar"
            aria-label="Favorites export progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                class="bg-accent h-full transition-[width] duration-150"
                style:width="{percent}%"
            ></div>
        </div>
    </div>
{/if}
