<script lang="ts">
    import {openURL} from '$lib/utils/browser';
    import {getAppOverrides} from '$lib/stores/theme.svelte';
    import {
        getActiveTab,
        getTargetsVisible,
        toggleTargetsVisible,
    } from '$lib/stores/ui.svelte';

    let overrideCount = $derived(
        Object.values(getAppOverrides()).reduce(
            (sum, o) => sum + Object.keys(o).length,
            0
        )
    );
    let showTargetsToggle = $derived(getActiveTab() === 'editor');
    let targetsVisible = $derived(getTargetsVisible());
</script>

<div
    class="bg-bg-secondary border-border text-fg-dimmed flex h-6 shrink-0 items-center justify-between border-t px-3 text-[10px]"
>
    <div class="flex items-center gap-3">
        <span>v{__APP_VERSION__}</span>
        {#if overrideCount > 0}
            <span class="text-accent" title="Active per-app template overrides">
                {overrideCount} override{overrideCount === 1 ? '' : 's'}
            </span>
        {/if}
    </div>
    <div class="flex items-center gap-3">
        {#if showTargetsToggle}
            <button
                class="hover:text-accent transition-colors duration-100 {targetsVisible
                    ? 'text-fg-secondary'
                    : ''}"
                onclick={toggleTargetsVisible}
                title={targetsVisible
                    ? 'Hide the Targets strip'
                    : 'Show the Targets strip'}
                aria-pressed={targetsVisible}
            >
                Targets
            </button>
        {/if}
        <button
            class="hover:text-accent transition-colors duration-100"
            onclick={() => openURL('https://github.com/bjarneo/aether')}
            title="Open GitHub repository">GitHub</button
        >
        <button
            class="hover:text-accent transition-colors duration-100"
            onclick={() => openURL('https://x.com/iamdothash')}
            title="Open X / Twitter profile">X / Twitter</button
        >
    </div>
</div>
