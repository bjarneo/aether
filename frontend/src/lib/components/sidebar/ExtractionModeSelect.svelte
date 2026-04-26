<script lang="ts">
    import {
        getExtractionMode,
        setExtractionMode,
        getWallpaperPath,
        getLightMode,
        setIsExtracting,
        setPalette,
        setAdjustments,
    } from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {
        EXTRACTION_MODES,
        EXTRACTION_MODE_GROUPS,
        type ExtractionMode,
        type ExtractionModeGroup,
    } from '$lib/constants/colors';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';

    let expanded = $state(true);

    const openGroups: Record<ExtractionModeGroup, boolean> = $state(
        Object.fromEntries(
            EXTRACTION_MODE_GROUPS.map(g => [g.id, g.defaultOpen])
        ) as Record<ExtractionModeGroup, boolean>
    );

    const grouped = $derived.by(() => {
        const out: Record<string, ExtractionMode[]> = {};
        for (const g of EXTRACTION_MODE_GROUPS) out[g.id] = [];
        for (const m of EXTRACTION_MODES) out[m.group].push(m);
        return out;
    });

    function activeInGroup(groupId: ExtractionModeGroup) {
        return grouped[groupId]?.find(m => m.value === getExtractionMode());
    }

    // Per-mode palette previews keyed by `${path}:${lightMode}:${mode}`.
    // Populated lazily by a serial prefetch keyed to the current wallpaper.
    let stripCache = $state<Record<string, string[]>>({});
    let prefetchToken = 0;
    let lastPrefetchKey = '';

    function stripKey(path: string, lm: boolean, mode: string): string {
        return `${path}:${lm ? 'L' : 'D'}:${mode}`;
    }

    async function prefetchStrips(path: string, lm: boolean) {
        if (!path) return;
        const myToken = ++prefetchToken;
        const {PreviewExtractColors} = await import(
            '../../../../wailsjs/go/main/App'
        );
        for (const mode of EXTRACTION_MODES) {
            if (myToken !== prefetchToken) return;
            const key = stripKey(path, lm, mode.value);
            if (stripCache[key]) continue;
            try {
                const colors = await PreviewExtractColors(path, lm, mode.value);
                if (myToken !== prefetchToken) return;
                if (Array.isArray(colors) && colors.length >= 8) {
                    stripCache = {...stripCache, [key]: colors};
                }
            } catch {
                // ignore — leave the strip empty for this mode
            }
        }
    }

    $effect(() => {
        const path = getWallpaperPath();
        const lm = getLightMode();
        const key = `${path}:${lm}`;
        if (key === lastPrefetchKey) return;
        lastPrefetchKey = key;
        prefetchStrips(path, lm);
    });

    function getStrip(mode: string): string[] | null {
        const key = stripKey(getWallpaperPath(), getLightMode(), mode);
        return stripCache[key] || null;
    }

    async function handleModeChange(mode: string) {
        if (mode === getExtractionMode()) return;

        setExtractionMode(mode);

        try {
            const {SetExtractionMode} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await SetExtractionMode(mode);
        } catch {}

        const path = getWallpaperPath();
        if (path) {
            setIsExtracting(true);
            try {
                const {ExtractColors} = await import(
                    '../../../../wailsjs/go/main/App'
                );
                const colors = await ExtractColors(path, getLightMode(), mode);
                setAdjustments({...DEFAULT_ADJUSTMENTS});
                setPalette(colors);
                showToast(`Re-extracted with ${mode} mode`);
            } catch {
                showToast('Couldn’t re-extract — try a different mode');
            } finally {
                setIsExtracting(false);
            }
        }
    }
</script>

{#snippet modeList(items: ExtractionMode[])}
    <ul class="flex flex-col">
        {#each items as mode}
            {@const isActive = getExtractionMode() === mode.value}
            {@const strip = getStrip(mode.value)}
            <li>
                <button
                    type="button"
                    onclick={() => handleModeChange(mode.value)}
                    title={mode.description}
                    aria-pressed={isActive}
                    class="hover:bg-bg-hover flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] transition-colors duration-100 {isActive
                        ? 'bg-bg-elevated text-accent border-border-focus border-l-2'
                        : 'text-fg-primary border-l-2 border-transparent'}"
                >
                    <span class="min-w-0 truncate">{mode.label}</span>
                    <span class="flex shrink-0 items-center gap-1">
                        {#if strip}
                            <span
                                class="border-border flex h-2.5 w-12 overflow-hidden border"
                                aria-hidden="true"
                            >
                                {#each [0, 1, 2, 3, 4, 5, 6, 7] as i}
                                    <span
                                        class="flex-1"
                                        style:background-color={strip[i]}
                                    ></span>
                                {/each}
                            </span>
                        {/if}
                        {#if isActive}
                            <span
                                class="text-accent text-[10px]"
                                aria-hidden="true">●</span
                            >
                        {/if}
                    </span>
                </button>
            </li>
        {/each}
    </ul>
{/snippet}

<ExpandableSection title="Extraction Mode" bind:expanded>
    <div class="flex flex-col gap-3">
        {#if grouped.auto?.length}
            {@render modeList(grouped.auto)}
        {/if}

        {#each EXTRACTION_MODE_GROUPS as group}
            {#if group.id !== 'auto'}
                {@const items = grouped[group.id]}
                {#if items?.length}
                    {@const isOpen = openGroups[group.id]}
                    {@const active = activeInGroup(group.id)}
                    <ExpandableSection
                        title={group.label}
                        suffix={!isOpen && active ? active.label : ''}
                        bind:expanded={openGroups[group.id]}
                    >
                        {@render modeList(items)}
                    </ExpandableSection>
                {/if}
            {/if}
        {/each}
    </div>
</ExpandableSection>
