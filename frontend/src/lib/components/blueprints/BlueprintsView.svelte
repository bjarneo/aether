<script lang="ts">
    import {onMount} from 'svelte';
    import BlueprintCard from './BlueprintCard.svelte';
    import SaveDialog from './SaveDialog.svelte';
    import {showToast, setActiveTab} from '$lib/stores/ui.svelte';
    import {
        setPalette,
        setWallpaperPath,
        setAdjustments,
        setAppOverrides,
        setAdditionalImages,
        setLastExtractedPath,
    } from '$lib/stores/theme.svelte';
    import {DEFAULT_ADJUSTMENTS, type Blueprint} from '$lib/types/theme';
    import EmptyState from '$lib/components/shared/EmptyState.svelte';
    import LoadingState from '$lib/components/shared/LoadingState.svelte';

    let blueprints = $state<Blueprint[]>([]);
    let isLoading = $state(true);
    let showSaveDialog = $state(false);

    onMount(() => {
        loadBlueprints();
    });

    async function loadBlueprints() {
        isLoading = true;
        try {
            const {ListBlueprints} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ListBlueprints();
            blueprints = (
                Array.isArray(result) ? (result as unknown as Blueprint[]) : []
            ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch {
            blueprints = [];
        } finally {
            isLoading = false;
        }
    }

    async function handleDelete(name: string) {
        try {
            const {DeleteBlueprint} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await DeleteBlueprint(name);
            blueprints = blueprints.filter(b => b.name !== name);
            showToast(`Deleted: ${name}`);
        } catch {
            showToast('Couldn’t delete that theme');
        }
    }

    async function handleLoad(bp: Blueprint) {
        try {
            if (bp.palette?.colors?.length >= 16) {
                setPalette(bp.palette.colors);
                if (bp.palette?.wallpaper) {
                    setWallpaperPath(bp.palette.wallpaper);
                }
            } else {
                const {LoadBlueprint} = await import(
                    '../../../../wailsjs/go/main/App'
                );
                await LoadBlueprint(bp.name);
            }
            setAdjustments({...DEFAULT_ADJUSTMENTS, ...(bp.adjustments ?? {})});
            setAppOverrides(bp.appOverrides ?? {});
            setAdditionalImages(bp.palette?.additionalImages ?? []);
            // Anchor the extract baseline to the blueprint's wallpaper so a
            // re-extract on it preserves the loaded overrides.
            if (bp.palette?.wallpaper) {
                setLastExtractedPath(bp.palette.wallpaper);
            }
            setActiveTab('editor');
            showToast(`Loaded: ${bp.name}`);
        } catch {
            showToast('Couldn’t load that blueprint');
        }
    }
</script>

<div class="flex h-full flex-col">
    <div
        class="bg-bg-secondary border-border flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
    >
        <span
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
            >My Themes</span
        >
        <button
            class="bg-accent hover:bg-accent-hover ml-auto px-2 py-0.5 text-[11px] font-medium text-[#111116] transition-colors"
            onclick={() => (showSaveDialog = true)}>Save Current</button
        >
    </div>

    <div class="flex-1 overflow-y-auto p-3">
        {#if isLoading}
            <LoadingState message="Loading themes…" />
        {:else if blueprints.length === 0}
            <EmptyState
                title="No themes saved yet"
                body="Save the current palette, adjustments, overrides, and wallpaper as a Blueprint to revisit later."
                actionLabel="Save current theme"
                onaction={() => (showSaveDialog = true)}
            >
                {#snippet icon()}
                    <svg
                        class="h-12 w-12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 17 12 22 22 17"></polyline>
                        <polyline points="2 12 12 17 22 12"></polyline>
                    </svg>
                {/snippet}
            </EmptyState>
        {:else}
            <div
                class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3"
            >
                {#each blueprints as bp, i (bp.name + '_' + i)}
                    <BlueprintCard
                        blueprint={bp}
                        onload={() => handleLoad(bp)}
                        ondelete={() => handleDelete(bp.name)}
                    />
                {/each}
            </div>
        {/if}
    </div>

    {#if showSaveDialog}
        <SaveDialog
            onclose={() => (showSaveDialog = false)}
            onsave={() => {
                showSaveDialog = false;
                loadBlueprints();
            }}
        />
    {/if}
</div>
