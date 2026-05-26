<script lang="ts">
    import {onMount} from 'svelte';
    import {
        setWallpaperPath,
        addAdditionalImage,
        getAdditionalImages,
    } from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
    import {applyWallpaperOnly} from '$lib/actions/themeActions';
    import {getIsApplying} from '$lib/stores/theme.svelte';
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
    import EmptyState from '$lib/components/shared/EmptyState.svelte';
    import LoadingState from '$lib/components/shared/LoadingState.svelte';
    import SearchIcon from '$lib/components/shared/SearchIcon.svelte';
    import type {wallpaper} from '../../../../wailsjs/go/models';

    type Wallpaper = wallpaper.WallpaperInfo;

    let wallpapers = $state<Wallpaper[]>([]);
    let isLoading = $state(true);
    let sortBy = $state<'name' | 'date' | 'size'>('date');
    let filterTag = $state<string>('');
    let query = $state<string>('');
    let previewIndex = $state(-1);
    let previewSrc = $state<string>('');

    // Viewport windowing: at 10k+ wallpapers, mounting every card freezes the
    // renderer. We measure the scroll container, compute how many rows fit,
    // and only mount the visible slice (plus a small buffer). Spacer divs at
    // top/bottom preserve scrollbar position so scrolling feels native.
    const MIN_CARD_WIDTH = 180; // matches grid's minmax(180px, 1fr)
    const CARD_GAP = 8; // matches gap-2
    const NAME_ROW_HEIGHT = 28; // TagPicker + name row
    const BUFFER_ROWS = 3; // rows rendered above + below the viewport

    let scrollContainer = $state<HTMLDivElement | null>(null);
    let scrollTop = $state(0);
    let containerHeight = $state(600);
    let containerWidth = $state(800);

    onMount(() => {
        loadWallpapers();
    });

    $effect(() => {
        if (!scrollContainer) return;
        const measure = () => {
            if (!scrollContainer) return;
            containerHeight = scrollContainer.clientHeight;
            containerWidth = scrollContainer.clientWidth;
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(scrollContainer);
        return () => ro.disconnect();
    });

    function handleScroll(e: Event) {
        scrollTop = (e.currentTarget as HTMLDivElement).scrollTop;
    }

    async function loadWallpapers() {
        isLoading = true;
        try {
            const {ScanLocalWallpapers} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ScanLocalWallpapers();
            wallpapers = Array.isArray(result) ? result : [];
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

            const q = query.trim().toLowerCase();
            if (q) {
                wps = wps.filter(wp => wp.name.toLowerCase().includes(q));
            }

            wps.sort((a, b) => {
                if (sortBy === 'name') return a.name.localeCompare(b.name);
                if (sortBy === 'size') return b.size - a.size;
                return b.modTime - a.modTime;
            });

            return wps;
        })()
    );

    // Available width is container minus horizontal padding (p-3 = 12px each side).
    let innerWidth = $derived(Math.max(0, containerWidth - 24));
    let columns = $derived(
        Math.max(
            1,
            Math.floor((innerWidth + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP))
        )
    );
    let cardWidth = $derived(
        columns > 0
            ? (innerWidth - (columns - 1) * CARD_GAP) / columns
            : MIN_CARD_WIDTH
    );
    // aspect-video thumb (16:9) + name row + bottom gap = one row's pitch.
    let rowHeight = $derived(
        Math.round((cardWidth * 9) / 16) + NAME_ROW_HEIGHT + CARD_GAP
    );
    let totalRows = $derived(Math.ceil(filtered.length / columns));
    let firstVisibleRow = $derived(
        Math.max(0, Math.floor(scrollTop / rowHeight) - BUFFER_ROWS)
    );
    let lastVisibleRow = $derived(
        Math.min(
            totalRows,
            Math.ceil((scrollTop + containerHeight) / rowHeight) + BUFFER_ROWS
        )
    );
    let visibleStart = $derived(firstVisibleRow * columns);
    let visibleEnd = $derived(
        Math.min(filtered.length, lastVisibleRow * columns)
    );
    let visibleSlice = $derived(filtered.slice(visibleStart, visibleEnd));
    let topSpacer = $derived(firstVisibleRow * rowHeight);
    let bottomSpacer = $derived(
        Math.max(0, (totalRows - lastVisibleRow) * rowHeight)
    );

    function selectWallpaper(path: string) {
        setWallpaperPath(path);
        setActiveTab('editor');
        showToast('Wallpaper selected — click Extract to generate palette');
    }

    async function handleBrowse() {
        try {
            const {OpenFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const path = await OpenFileDialog();
            if (path) selectWallpaper(path);
        } catch (err) {
            console.error('OpenFileDialog failed', err);
        }
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
        <button
            class="bg-accent hover:bg-accent-hover px-2 py-0.5 text-[11px] font-medium text-[#111116] transition-colors"
            onclick={handleBrowse}
            title="Browse local files">Browse…</button
        >

        <span class="bg-border mx-1 h-4 w-px"></span>

        <input
            type="search"
            bind:value={query}
            placeholder="Search name or folder…"
            class="bg-bg-primary text-fg-primary border-border focus:border-border-focus placeholder:text-fg-dimmed w-44 border px-2 py-0.5 text-[11px] outline-none transition-colors"
        />

        {#if query}
            <button
                class="text-fg-dimmed hover:text-fg-secondary px-1 text-[11px]"
                onclick={() => (query = '')}
                title="Clear search"
                aria-label="Clear search">×</button
            >
        {/if}

        <span class="bg-border mx-1 h-4 w-px"></span>

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

    <div
        class="flex-1 overflow-y-auto p-3"
        bind:this={scrollContainer}
        onscroll={handleScroll}
    >
        {#if isLoading}
            <LoadingState message="Scanning ~/Wallpapers…" />
        {:else if filtered.length === 0}
            {#if query || filterTag}
                <EmptyState
                    title={query
                        ? `No matches for "${query}"`
                        : 'No wallpapers with this label'}
                    body="Adjust your search or filters to see more wallpapers."
                    actionLabel="Clear filters"
                    onaction={() => {
                        query = '';
                        filterTag = '';
                    }}
                >
                    {#snippet icon()}
                        <SearchIcon size="h-12 w-12" strokeWidth={1.5} />
                    {/snippet}
                </EmptyState>
            {:else}
                <EmptyState
                    title="No wallpapers in ~/Wallpapers"
                    body="Drop images into ~/Wallpapers (or any subfolder), or browse to pick a single file."
                    actionLabel="Browse for a file…"
                    onaction={handleBrowse}
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
                            <path
                                d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                            ></path>
                        </svg>
                    {/snippet}
                </EmptyState>
            {/if}
        {:else}
            {#if topSpacer > 0}
                <div aria-hidden="true" style="height: {topSpacer}px"></div>
            {/if}
            <div
                class="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2"
            >
                {#each visibleSlice as wp, sliceIdx (wp.path)}
                    {@const i = visibleStart + sliceIdx}
                    <div
                        class="bg-bg-surface border-border hover:border-border-focus group relative border transition-colors duration-100"
                    >
                        <button
                            class="w-full text-left"
                            onclick={() => selectWallpaper(wp.path)}
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
                            class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                        >
                            <button
                                class="bg-accent hover:bg-accent-hover pointer-events-auto min-w-[7rem] px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors"
                                onclick={() => selectWallpaper(wp.path)}
                                title="Set as wallpaper and open in editor"
                                >Use</button
                            >
                            <div
                                class="flex items-center gap-2 text-[10px] text-white/85"
                            >
                                <button
                                    class="pointer-events-auto px-1 transition-colors hover:text-white disabled:opacity-50"
                                    onclick={() => applyWallpaperOnly(wp.path)}
                                    disabled={getIsApplying()}
                                    title="Apply this wallpaper without changing the current palette"
                                    >Wallpaper only</button
                                >
                                <span class="text-white/30" aria-hidden="true"
                                    >·</span
                                >
                                <button
                                    class="pointer-events-auto px-1 transition-colors hover:text-white"
                                    onclick={() => handlePreview(i)}
                                    title="Preview wallpaper full-size"
                                    >Preview</button
                                >
                            </div>
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
            {#if bottomSpacer > 0}
                <div aria-hidden="true" style="height: {bottomSpacer}px"></div>
            {/if}
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
