<script lang="ts">
    import {onMount} from 'svelte';
    import type {icontheme} from '../../../../wailsjs/go/models';

    let {themeId, themeName, hasPreview} = $props<{
        themeId: string;
        themeName: string;
        hasPreview: boolean;
    }>();

    type Sample = icontheme.PreviewSample;
    const concepts = [
        {kind: 'folder', label: 'Folder'},
        {kind: 'utility', label: 'System utility'},
        {kind: 'application', label: 'Application'},
    ] as const;

    let container = $state<HTMLSpanElement | null>(null);
    let samples = $state<Sample[]>([]);
    let loaded = $state(false);
    let loading = $state(false);
    let byKind = $derived(new Map(samples.map(sample => [sample.kind, sample])));

    async function loadPreview() {
        if (!hasPreview || loaded || loading) return;
        loading = true;
        try {
            const {GetIconThemePreview} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GetIconThemePreview(themeId);
            samples = Array.isArray(result?.samples) ? result.samples : [];
        } catch {
            samples = [];
        } finally {
            loaded = true;
            loading = false;
        }
    }

    onMount(() => {
        if (!hasPreview || !container) {
            loaded = true;
            return;
        }
        if (!('IntersectionObserver' in window)) {
            loadPreview();
            return;
        }
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    observer.disconnect();
                    loadPreview();
                }
            },
            {rootMargin: '80px'}
        );
        observer.observe(container);
        return () => observer.disconnect();
    });
</script>

<span bind:this={container} class="mt-1.5 flex items-center gap-1.5">
    {#each concepts as concept}
        {@const sample = byKind.get(concept.kind)}
        <span
            class="bg-bg-surface border-border flex h-9 w-9 items-center justify-center border"
            title={`${concept.label} preview`}
        >
            {#if sample}
                <img
                    src={sample.pngData}
                    alt={`${concept.label} icon from ${themeName}`}
                    class="h-7 w-7 object-contain"
                />
            {:else}
                <span
                    class="text-fg-dimmed text-[9px]"
                    aria-hidden="true">—</span
                >
            {/if}
        </span>
    {/each}
    {#if loaded && samples.length === 0}
        <span class="text-fg-dimmed ml-1 text-[9px]">Preview unavailable</span>
    {/if}
</span>
