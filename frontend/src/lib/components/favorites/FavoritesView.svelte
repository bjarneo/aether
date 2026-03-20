<script lang="ts">
    import {onMount} from 'svelte';
    import {setWallpaperPath} from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
    import {
        getCachedThumbnail,
        loadThumbnail,
        isThumbnailCached,
        setCachedImage,
        loadFullImage,
        getCachedFullImage,
    } from '$lib/stores/imagecache.svelte';
    import {getLabels, getAssignments} from '$lib/stores/tags.svelte';
    import TagPicker from '$lib/components/shared/TagPicker.svelte';
    import ImagePreview from '$lib/components/shared/ImagePreview.svelte';

    let favorites = $state<any[]>([]);
    let isLoading = $state(true);
    let filterTag = $state<string>('');
    let previewIndex = $state(-1);
    let previewSrc = $state<string>('');

    let allLabels = $derived(getLabels());
    let allAssignments = $derived(getAssignments());

    let filtered = $derived(
        filterTag
            ? favorites.filter(f => allAssignments[f.path] === filterTag)
            : favorites
    );

    onMount(() => {
        loadFavorites();
    });

    async function loadFavorites() {
        isLoading = true;
        try {
            const fn = (window as any)?.go?.main?.App?.GetFavorites;
            if (!fn) {
                favorites = [];
                isLoading = false;
                return;
            }
            const result = await fn();
            favorites = Array.isArray(result) ? result : [];
            loadThumbnails();
        } catch {
            favorites = [];
        } finally {
            isLoading = false;
        }
    }

    async function loadThumbnails() {
        for (const fav of favorites) {
            if (isThumbnailCached(fav.path)) continue;

            // Wallhaven thumbs are remote URLs — cache directly
            if (fav.data?.thumbUrl && fav.data.thumbUrl.startsWith('http')) {
                setCachedImage('thumb:' + fav.path, fav.data.thumbUrl);
                continue;
            }

            // Local files — load thumbnail
            loadThumbnail(fav.path);
        }
    }

    async function handleSelect(fav: any) {
        let localPath = fav.path;

        if (
            localPath &&
            (localPath.startsWith('http://') ||
                localPath.startsWith('https://'))
        ) {
            try {
                showToast('Downloading wallpaper...');
                const {DownloadWallpaper} = await import(
                    '../../../../wailsjs/go/main/App'
                );
                localPath = await DownloadWallpaper(localPath);
            } catch {
                showToast('Failed to download wallpaper');
                return;
            }
        }

        setWallpaperPath(localPath);
        setActiveTab('editor');
        showToast('Wallpaper selected — click Extract to generate palette');
    }

    async function handleRemove(fav: any) {
        try {
            const {ToggleFavorite} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ToggleFavorite(fav.path, fav.type, {});
            favorites = favorites.filter(f => f.path !== fav.path);
        } catch {}
    }

    async function resolvePreviewSrc(fav: any): Promise<string> {
        if (fav.path?.startsWith('http')) return fav.path;
        const cached = getCachedFullImage(fav.path);
        return cached || (await loadFullImage(fav.path));
    }

    async function handlePreview(index: number) {
        previewSrc = await resolvePreviewSrc(filtered[index]);
        previewIndex = index;
    }

    async function navigatePreview(index: number) {
        previewSrc = await resolvePreviewSrc(filtered[index]);
        previewIndex = index;
    }
</script>

<div class="flex h-full flex-col">
    <div
        class="bg-bg-secondary border-border flex flex-wrap items-center gap-1.5 border-b px-3 py-2"
    >
        <span
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
            >Favorites</span
        >

        <span class="bg-border mx-1 h-4 w-px"></span>

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
            >{filtered.length}{filterTag ? `/${favorites.length}` : ''}</span
        >
    </div>

    <div class="flex-1 overflow-y-auto p-3">
        {#if isLoading}
            <div class="flex h-32 items-center justify-center">
                <span class="text-fg-dimmed text-[11px]"
                    >Loading favorites...</span
                >
            </div>
        {:else if filtered.length === 0}
            <div class="flex h-32 items-center justify-center text-center">
                <p class="text-fg-dimmed text-[11px]">
                    {filterTag
                        ? 'No favorites with this label'
                        : 'No favorites yet'}
                </p>
            </div>
        {:else}
            <div
                class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2"
            >
                {#each filtered as fav, i (fav.path)}
                    <div
                        class="bg-bg-surface border-border group relative border"
                    >
                        <div
                            class="flex aspect-video items-center justify-center overflow-hidden bg-[#0a0a0e]"
                        >
                            {#if getCachedThumbnail(fav.path)}
                                <img
                                    src={getCachedThumbnail(fav.path)}
                                    alt=""
                                    class="h-full w-full object-cover"
                                />
                            {:else}
                                <span class="text-fg-dimmed text-[9px]"
                                    >...</span
                                >
                            {/if}
                        </div>

                        <div
                            class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        >
                            <button
                                class="bg-accent hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors"
                                onclick={() => handleSelect(fav)}>Use</button
                            >
                            <button
                                class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors"
                                onclick={() => handlePreview(i)}>Preview</button
                            >
                        </div>

                        <button
                            class="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center opacity-100"
                            onclick={() => handleRemove(fav)}
                            aria-label="Remove from favorites"
                        >
                            <svg
                                class="text-destructive h-4 w-4"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path
                                    d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                                ></path>
                            </svg>
                        </button>

                        <div class="flex items-center gap-1.5 px-2 py-1">
                            <TagPicker path={fav.path} />
                            <span
                                class="text-fg-dimmed flex-1 truncate text-[10px]"
                            >
                                {fav.data?.name || fav.data?.id || 'Wallpaper'}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<ImagePreview
    src={previewSrc}
    alt={previewIndex >= 0
        ? filtered[previewIndex]?.data?.name || 'Favorite wallpaper'
        : ''}
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
