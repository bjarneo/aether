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
    } from '$lib/stores/theme.svelte';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';

    let blueprints = $state<any[]>([]);
    let isLoading = $state(true);
    let showSaveDialog = $state(false);

    onMount(() => {
        loadBlueprints();
    });

    async function loadBlueprints() {
        isLoading = true;
        try {
            const fn = (window as any)?.go?.main?.App?.ListBlueprints;
            if (!fn) {
                blueprints = [];
                isLoading = false;
                return;
            }
            const result = await fn();
            blueprints = Array.isArray(result) ? result : [];
            blueprints.sort(
                (a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0)
            );
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
            showToast('Failed to delete');
        }
    }

    async function handleLoad(bp: any) {
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
            setAdjustments(bp.adjustments ?? {...DEFAULT_ADJUSTMENTS});
            setAppOverrides(bp.appOverrides ?? {});
            setAdditionalImages(bp.palette?.additionalImages ?? []);
            setActiveTab('editor');
            showToast(`Loaded: ${bp.name}`);
        } catch {
            showToast('Failed to load');
        }
    }
</script>

<div class="flex h-full flex-col">
    <div
        class="bg-bg-secondary border-border flex items-center gap-2 border-b p-3"
    >
        <span
            class="text-fg-dimmed text-[12px] font-medium uppercase tracking-wider"
            >My Themes</span
        >
        <button
            class="bg-accent hover:bg-accent-hover ml-auto px-3 py-1 text-[11px] font-medium text-[#111116]"
            onclick={() => (showSaveDialog = true)}>Save Current</button
        >
    </div>

    <div class="flex-1 overflow-y-auto p-3">
        {#if isLoading}
            <div
                class="text-fg-dimmed flex h-32 items-center justify-center text-[12px]"
            >
                Loading themes...
            </div>
        {:else if blueprints.length === 0}
            <div
                class="text-fg-dimmed flex h-32 items-center justify-center text-[12px]"
            >
                No themes saved yet
            </div>
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
