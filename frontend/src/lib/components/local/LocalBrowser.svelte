<script lang="ts">
    import {onMount} from 'svelte';
    import {
        setWallpaperPath,
        addAdditionalImage,
        getAdditionalImages,
    } from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
    import {
        getLabels,
        getLabelForPath,
        getAssignments,
    } from '$lib/stores/tags.svelte';
    import {
        loadFullImage,
        getCachedFullImage,
    } from '$lib/stores/imagecache.svelte';
    import LazyImage from '$lib/components/shared/LazyImage.svelte';
    import TagPicker from '$lib/components/shared/TagPicker.svelte';
    import ImagePreview from '$lib/components/shared/ImagePreview.svelte';
    import type {wallpaper} from '../../../../wailsjs/go/models';

    type Wallpaper = wallpaper.WallpaperInfo;

    let wallpapers = $state<Wallpaper[]>([]);
    let isLoading = $state(true);
    let sortBy = $state<'name' | 'date' | 'size'>('date');
    let filterTag = $state<string>('');
    let previewIndex = $state(-1);
    let previewSrc = $state<string>('');

    onMount(() => {
        loadWallpapers();
    });

    async function loadWallpapers() {
        isLoading = true;
        try {
            const {ScanLocalWallpapers} = await import(
                '../../../../wailsjs/go/main/App'
            );
            wallpapers = await ScanLocalWallpapers();
        } catch {
            wallpapers = [];
        } finally {
            isLoading = false;
        }
    }

    let allLabels = $derived(getLabels());
    let allAssignments = $derived(getAssignments());

    let filtered = $derived(
        (() => {
            let wps = [...wallpapers];

            if (filterTag) {
                wps = wps.filter(wp => allAssignments[wp.path] === filterTag);
            }

            wps.sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'size') return b.size - a.size;
                return b.modTime - a.modTime;
            });

            return wps;
        })()
    );

    function handleSelect(wp: Wallpaper) {
        setWallpaperPath(wp.path);
        setActiveTab('editor');
        showToast('Wallpaper selected — click Extract to generate palette');
    }

    function handleAddExtra(path: string) {
        if (getAdditionalImages().includes(path)) {
            showToast('Already in additional images');
            return;
        }
        addAdditionalImage(path);
        showToast('Added to additional images');
    }

    async function handlePreview(index: number) {
        const wp = filtered[index];
        const cached = getCachedFullImage(wp.path);
        previewSrc = cached || (await loadFullImage(wp.path));
        previewIndex = index;
    }

    async function navigatePreview(index: number) {
        const wp = filtered[index];
        const cached = getCachedFullImage(wp.path);
        previewSrc = cached || (await loadFullImage(wp.path));
        previewIndex = index;
    }
</script>

<div class="flex h-full flex-col">
    <div
        class="bg-bg-secondary border-border flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
    >
        <!-- Sort -->
        <span class="text-fg-dimmed text-[10px] uppercase tracking-wider"
            >Sort</span
        >
        {#each ['date', 'name', 'size'] as option}
            <button
                class="px-2 py-0.5 text-[11px] transition-colors duration-100
          {sortBy === option
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
                onclick={() => (sortBy = option as any)}>{option}</button
            >
        {/each}

        <span class="bg-border mx-1 h-4 w-px"></span>

        <!-- Label filter -->
        {#if allLabels.length > 0}
            <button
                class="px-2 py-0.5 text-[10px] transition-colors duration-100
          {!filterTag
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover'}"
                onclick={() => (filterTag = '')}>All</button
            >
            {#each allLabels as label}
                <button
                    class="flex items-center gap-1 px-1.5 py-0.5 text-[10px] transition-all"
                    style={filterTag === label.id
                        ? `background: ${label.color}20; border: 1px solid ${label.color}40; color: ${label.color};`
                        : ''}
                    class:text-fg-dimmed={filterTag !== label.id}
                    class:hover:text-fg-secondary={filterTag !== label.id}
                    onclick={() =>
                        (filterTag = filterTag === label.id ? '' : label.id)}
                >
                    <span
                        class="h-2 w-2 shrink-0"
                        style:background-color={label.color}
                    ></span>
                    {label.name}
                </button>
            {/each}
        {/if}

        <span class="text-fg-dimmed ml-auto text-[10px]"
            >{filtered.length}{filterTag ? `/${wallpapers.length}` : ''}</span
        >
    </div>

    <div class="flex-1 overflow-y-auto p-3">
        {#if isLoading}
            <div class="flex h-32 items-center justify-center">
                <span class="text-fg-dimmed text-[11px]"
                    >Scanning ~/Wallpapers...</span
                >
            </div>
        {:else if filtered.length === 0}
            <div class="flex h-32 items-center justify-center">
                <span class="text-fg-dimmed text-[11px]">
                    {filterTag
                        ? 'No wallpapers with this label'
                        : 'No wallpapers found in ~/Wallpapers'}
                </span>
            </div>
        {:else}
            <div
                class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2"
            >
                {#each filtered as wp, i (wp.path)}
                    <div
                        class="bg-bg-surface border-border hover:border-border-focus group relative border transition-colors duration-100"
                    >
                        <button
                            class="w-full text-left"
                            onclick={() => handleSelect(wp)}
                        >
                            <div
                                class="bg-bg-primary aspect-video overflow-hidden"
                            >
                                <LazyImage path={wp.path} alt={wp.name} />
                            </div>
                        </button>
                        <button
                            class="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center transition-all duration-150
                          {getAdditionalImages().includes(wp.path)
                                ? 'opacity-100'
                                : 'opacity-0 hover:!opacity-100 group-hover:opacity-60'}"
                            onclick={e => {
                                e.stopPropagation();
                                handleAddExtra(wp.path);
                            }}
                            aria-label="Add to additional images"
                        >
                            <svg
                                class="h-4 w-4 {getAdditionalImages().includes(
                                    wp.path
                                )
                                    ? 'text-accent'
                                    : 'text-white'}"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect
                                    x="3"
                                    y="3"
                                    width="18"
                                    height="18"
                                    rx="2"
                                    ry="2"
                                ></rect>
                                <line x1="12" y1="8" x2="12" y2="16"></line>
                                <line x1="8" y1="12" x2="16" y2="12"></line>
                            </svg>
                        </button>
                        <div
                            class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        >
                            <button
                                class="bg-accent hover:bg-accent-hover pointer-events-auto px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors"
                                onclick={() => handleSelect(wp)}>Use</button
                            >
                            <button
                                class="text-fg-primary bg-bg-elevated hover:bg-border-focus pointer-events-auto px-4 py-1.5 text-[11px] font-medium transition-colors"
                                onclick={() => handlePreview(i)}>Preview</button
                            >
                        </div>
                        <div class="flex items-center gap-1.5 px-2 py-1">
                            <TagPicker path={wp.path} />
                            <span
                                class="text-fg-dimmed flex-1 truncate text-[10px]"
                                >{wp.name}</span
                            >
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<ImagePreview
    src={previewSrc}
    alt={previewIndex >= 0 ? filtered[previewIndex]?.name : ''}
    open={previewIndex >= 0}
    onclose={() => {
        previewIndex = -1;
        previewSrc = '';
    }}
    hasPrev={previewIndex > 0}
    hasNext={previewIndex < filtered.length - 1}
    onprev={() => navigatePreview(previewIndex - 1)}
    onnext={() => navigatePreview(previewIndex + 1)}
/>
