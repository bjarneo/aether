<script lang="ts">
    import FilterControls from './FilterControls.svelte';
    import {
        getWallpaperPath,
        setWallpaperPath,
        setIsExtracting,
        setPalette,
        getLightMode,
        getExtractionMode,
    } from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {
        getCachedFullImage,
        loadFullImage,
        setCachedImage,
        isVideoSource,
    } from '$lib/stores/imagecache.svelte';
    import {
        applyFilters,
        hasActiveFilters,
        DEFAULT_FILTERS,
        type Filters,
    } from '$lib/utils/canvas-filters';

    let {open = false, onclose}: {open: boolean; onclose: () => void} =
        $props();

    let filters = $state<Filters>({...DEFAULT_FILTERS});
    let isProcessing = $state(false);
    let showOriginal = $state(false);
    let imgReady = $state(false);
    let imgEl = $state<HTMLImageElement | null>(null);
    let previewUrl = $state('');

    let originalUrl = $derived(getCachedFullImage(getWallpaperPath()) || '');
    let isVideo = $derived(isVideoSource(originalUrl));
    let hasChanges = $derived(!isVideo && hasActiveFilters(filters));

    // Load image when editor opens
    $effect(() => {
        if (open) {
            filters = {...DEFAULT_FILTERS};
            previewUrl = '';
            imgReady = false;
            imgEl = null;
            const path = getWallpaperPath();
            if (path && !getCachedFullImage(path)) {
                loadFullImage(path);
            }
        }
    });

    // Re-render preview whenever filters or image readiness changes
    let previewTimer: ReturnType<typeof setTimeout> | null = null;

    function renderPreview() {
        if (!imgEl || !imgReady) return;
        if (hasActiveFilters(filters)) {
            previewUrl = applyFilters(imgEl, filters, 1200);
        } else {
            previewUrl = '';
        }
    }

    // Watch for filter changes
    $effect(() => {
        // Touch every filter field to track dependencies
        const _ = JSON.stringify(filters);
        if (!open || !imgReady) return;
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, 60);
    });

    function resetFilters() {
        filters = {...DEFAULT_FILTERS};
        previewUrl = '';
    }

    function handleImageLoad(e: Event) {
        imgEl = e.target as HTMLImageElement;
        imgReady = true;
    }

    async function handleApply() {
        if (!imgEl || !imgReady || !hasChanges) {
            onclose();
            return;
        }
        isProcessing = true;
        try {
            // Full-res export from canvas (no maxSize limit)
            const fullResDataUrl = applyFilters(imgEl, filters);

            const {SaveDataURLToFile} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const savedPath = await SaveDataURLToFile(
                fullResDataUrl,
                getWallpaperPath()
            );

            setWallpaperPath(savedPath);
            setCachedImage(savedPath, fullResDataUrl);

            showToast('Filters applied — click Extract to generate palette');
            onclose();
        } catch (e: any) {
            console.error('Apply failed:', e);
            showToast('Failed to apply: ' + (e?.message || ''));
        } finally {
            isProcessing = false;
        }
    }
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex flex-col bg-black"
        onkeydown={e => e.key === 'Escape' && onclose()}
    >
        <!-- Top toolbar -->
        <div
            class="flex h-11 shrink-0 items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0c0c10] px-5"
        >
            <div class="flex items-center gap-3">
                <span
                    class="text-fg-primary text-[12px] font-semibold tracking-wide"
                    >Image Editor</span
                >
                {#if hasChanges}
                    <span class="text-accent text-[10px]">Modified</span>
                {/if}
            </div>
            <div class="flex items-center gap-2">
                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-4 py-1.5 text-[11px] transition-colors"
                    onclick={resetFilters}>Reset All</button
                >
                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-4 py-1.5 text-[11px] transition-colors"
                    onclick={onclose}>Cancel</button
                >
                <button
                    class="bg-accent hover:bg-accent-hover px-5 py-1.5 text-[11px] font-medium text-[#111116] transition-colors disabled:opacity-40"
                    onclick={handleApply}
                    disabled={isProcessing || !hasChanges}
                    >{isProcessing ? 'Exporting...' : 'Apply & Extract'}</button
                >
            </div>
        </div>

        <!-- Main content -->
        <div class="flex flex-1 overflow-hidden">
            <div class="flex flex-1 flex-col bg-[#080809]">
                <div
                    class="relative flex flex-1 items-center justify-center p-6"
                >
                    {#if originalUrl && isVideo}
                        <!-- svelte-ignore a11y_media_has_caption -->
                        <video
                            src={originalUrl}
                            autoplay
                            loop
                            muted
                            playsinline
                            class="max-h-full max-w-full object-contain"
                            style="filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5))"
                        ></video>
                    {:else if originalUrl}
                        <!-- Hidden image for canvas source — must be in DOM to trigger onload -->
                        <img
                            src={originalUrl}
                            alt=""
                            class="hidden"
                            onload={handleImageLoad}
                        />

                        <!-- Visible preview -->
                        {#if showOriginal || !previewUrl}
                            <img
                                src={originalUrl}
                                alt="Original"
                                class="max-h-full max-w-full object-contain"
                                style="filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5))"
                            />
                        {:else}
                            <img
                                src={previewUrl}
                                alt="Preview"
                                class="max-h-full max-w-full object-contain"
                                style="filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5))"
                            />
                        {/if}

                        {#if !imgReady}
                            <div
                                class="absolute inset-0 flex items-center justify-center bg-black/40"
                            >
                                <span class="text-fg-dimmed text-[12px]"
                                    >Loading image...</span
                                >
                            </div>
                        {/if}
                    {:else}
                        <span class="text-fg-dimmed text-[12px]"
                            >Loading image...</span
                        >
                    {/if}
                </div>

                <!-- Bottom bar -->
                <div
                    class="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] bg-[#0c0c10] px-5 py-2"
                >
                    <button
                        class="text-fg-dimmed hover:text-fg-secondary border border-[rgba(255,255,255,0.06)] px-3 py-1 text-[10px] transition-colors"
                        onmousedown={() => (showOriginal = true)}
                        onmouseup={() => (showOriginal = false)}
                        onmouseleave={() => (showOriginal = false)}
                        >{showOriginal
                            ? 'Showing Original'
                            : 'Hold to Compare'}</button
                    >

                    <span class="text-fg-dimmed text-[10px]">
                        Live preview · Double-click slider to reset
                    </span>
                </div>
            </div>

            <div
                class="flex w-72 flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0e0e13]"
            >
                <FilterControls
                    bind:filters
                    onpreview={() => renderPreview()}
                />
            </div>
        </div>
    </div>
{/if}
