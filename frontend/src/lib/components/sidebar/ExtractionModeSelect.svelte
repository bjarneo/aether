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
                showToast('Re-extraction failed');
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
            <li>
                <button
                    type="button"
                    onclick={() => handleModeChange(mode.value)}
                    title={mode.description}
                    aria-pressed={isActive}
                    class="hover:bg-bg-hover flex w-full items-center justify-between px-2 py-1.5 text-left text-[11px] transition-colors duration-100 {isActive
                        ? 'bg-bg-elevated text-accent border-border-focus border-l-2'
                        : 'text-fg-primary border-l-2 border-transparent'}"
                >
                    <span class="truncate">{mode.label}</span>
                    {#if isActive}
                        <span
                            class="text-accent ml-2 text-[10px]"
                            aria-hidden="true">●</span
                        >
                    {/if}
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
