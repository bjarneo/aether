<script lang="ts">
    import FilterControls from './FilterControls.svelte';
    import CropOverlay from './CropOverlay.svelte';
    import {getWallpaperPath, setWallpaperPath} from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {
        getCachedFullImage,
        loadFullImage,
        setCachedImage,
        isVideoSource,
    } from '$lib/stores/imagecache.svelte';
    import {
        applyFilters,
        renderToCanvas,
        hasActiveFilters,
        computeHistogram,
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
    let cropMode = $state(false);
    let cropAspectRatio = $state(0);
    let displayImgEl = $state<HTMLImageElement | null>(null);
    let previewAreaEl = $state<HTMLElement | null>(null);
    let previewCanvasEl = $state<HTMLCanvasElement | null>(null);
    let histogram = $state<number[]>([]);
    let modalEl = $state<HTMLElement | null>(null);

    // Filter undo/redo — separate from the palette history. Tracks snapshots
    // of the Filters object across edits within a single editor session.
    const MAX_HISTORY = 50;
    let undoStack = $state<Filters[]>([]);
    let redoStack = $state<Filters[]>([]);
    let baseline = $state<Filters>({...DEFAULT_FILTERS});
    let historyInitialized = false;
    let commitTimer: ReturnType<typeof setTimeout> | null = null;
    let suppressCommit = false; // set during undo/redo to avoid self-committing

    let originalUrl = $derived(getCachedFullImage(getWallpaperPath()) || '');
    let isVideo = $derived(isVideoSource(originalUrl));
    let hasChanges = $derived(!isVideo && hasActiveFilters(filters));
    let naturalWidth = $derived(imgEl?.naturalWidth ?? 0);
    let naturalHeight = $derived(imgEl?.naturalHeight ?? 0);
    let canUndo = $derived(undoStack.length > 0);
    let canRedo = $derived(redoStack.length > 0);

    // Derived: whether to show the filtered canvas or the original <img>.
    // In crop mode we always show the original (crop coords are in source
    // space, so rendering with filters applied would misposition the overlay).
    let showCanvas = $derived(
        !cropMode && !showOriginal && hasActiveFilters(filters)
    );

    // Load image when editor opens
    $effect(() => {
        if (open) {
            filters = {...DEFAULT_FILTERS};
            baseline = {...DEFAULT_FILTERS};
            undoStack = [];
            redoStack = [];
            historyInitialized = false;
            showOriginal = false;
            imgReady = false;
            imgEl = null;
            cropMode = false;
            cropAspectRatio = 0;
            const path = getWallpaperPath();
            if (path && !getCachedFullImage(path)) {
                loadFullImage(path);
            }
        }
    });

    // Re-render preview whenever filters change. Writes directly into the
    // bound <canvas> — no JPEG encoding, no dataURL allocation, no <img>
    // decode. This is the perf-critical path: previously each slider tick
    // round-tripped through toDataURL + <img src=> decode which leaked
    // bitmap cache and got laggier over time.
    // Maximum dimension (px) the preview canvas is downscaled to before
    // applying filters. Big enough to look sharp in the editor pane,
    // small enough that slider drags repaint smoothly.
    const PREVIEW_RENDER_SIZE_PX = 1000;
    // Slight delay so chained filter changes coalesce into one repaint.
    const PREVIEW_RENDER_DELAY_MS = 80;
    // Window after the last filter change before we commit it as a
    // history step. Tunes how undo "chunks" rapid edits.
    const HISTORY_COMMIT_DELAY_MS = 400;

    let previewTimer: ReturnType<typeof setTimeout> | null = null;

    function renderPreview() {
        if (!imgEl || !imgReady || !previewCanvasEl) return;
        if (cropMode) return; // canvas hidden; don't waste work
        if (!hasActiveFilters(filters)) return; // <img> shown instead
        renderToCanvas(imgEl, filters, previewCanvasEl, PREVIEW_RENDER_SIZE_PX);
    }

    // onpreview from FilterControls is redundant — the $effect below already
    // re-renders on every filter change. Keep it as a no-op so child-side
    // debounce calls don't double-trigger the canvas pipeline.
    const noopPreview = () => {};

    // Track last-rendered filter fingerprint so we don't re-render on effects
    // that didn't actually change filter state (e.g., cropMode toggle only).
    let lastRenderedKey = '';

    $effect(() => {
        const key = JSON.stringify(filters) + ':' + cropMode;
        if (!open || !imgReady) return;
        if (key === lastRenderedKey) return;
        lastRenderedKey = key;
        if (previewTimer) clearTimeout(previewTimer);
        previewTimer = setTimeout(renderPreview, PREVIEW_RENDER_DELAY_MS);
    });

    // Debounced history commit. Fires once after user action settles. Compares
    // current filters to the last-committed baseline; if they differ, pushes
    // baseline to undoStack and rolls baseline forward. Skips the first run
    // after open (which would push the default as a useless first undo step).
    $effect(() => {
        const _ = JSON.stringify(filters);
        if (!open) return;
        if (!historyInitialized) {
            historyInitialized = true;
            return;
        }
        if (suppressCommit) return;
        if (commitTimer) clearTimeout(commitTimer);
        commitTimer = setTimeout(() => {
            if (JSON.stringify(filters) === JSON.stringify(baseline)) return;
            undoStack = [...undoStack, baseline];
            if (undoStack.length > MAX_HISTORY)
                undoStack = undoStack.slice(-MAX_HISTORY);
            baseline = {...filters};
            redoStack = [];
        }, HISTORY_COMMIT_DELAY_MS);
    });

    function handleUndo() {
        const prev = undoStack[undoStack.length - 1];
        if (!prev) return;
        suppressCommit = true;
        redoStack = [...redoStack, {...baseline}];
        filters = {...prev};
        baseline = {...prev};
        undoStack = undoStack.slice(0, -1);
        queueMicrotask(() => (suppressCommit = false));
    }

    function handleRedo() {
        const next = redoStack[redoStack.length - 1];
        if (!next) return;
        suppressCommit = true;
        undoStack = [...undoStack, {...baseline}];
        filters = {...next};
        baseline = {...next};
        redoStack = redoStack.slice(0, -1);
        queueMicrotask(() => (suppressCommit = false));
    }

    function resetFilters() {
        filters = {...DEFAULT_FILTERS};
        cropMode = false;
        cropAspectRatio = 0;
    }

    function handleCropChange(x: number, y: number, w: number, h: number) {
        filters = {...filters, cropX: x, cropY: y, cropW: w, cropH: h};
    }

    function handleImageLoad(e: Event) {
        imgEl = e.target as HTMLImageElement;
        imgReady = true;
        histogram = computeHistogram(imgEl);
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

    // Stop the event from reaching the document-level shortcut handler
    // (App.svelte's registerShortcut). Otherwise Ctrl+Z in the editor would
    // also trigger palette undo, Ctrl+Enter would apply the theme, etc.
    function consume(e: KeyboardEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleKeydown(e: KeyboardEvent) {
        const target = e.target as HTMLElement;
        const inInput =
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable);

        if (e.key === 'Escape') {
            // Inside an input, Esc just blurs the input — closing the whole
            // editor while typing would be destructive.
            if (inInput) {
                target.blur();
                consume(e);
                return;
            }
            if (cropMode) {
                cropMode = false;
                consume(e);
                return;
            }
            onclose();
            consume(e);
            return;
        }

        if (inInput) return;

        // Undo / Redo — works with or without Shift (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y)
        if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                if (canUndo) handleUndo();
                consume(e);
                return;
            }
            if ((key === 'z' && e.shiftKey) || key === 'y') {
                if (canRedo) handleRedo();
                consume(e);
                return;
            }
            if (key === 'enter') {
                handleApply();
                consume(e);
                return;
            }
        }

        if (e.ctrlKey || e.metaKey || e.altKey) return;

        switch (e.key.toLowerCase()) {
            case 'c':
                cropMode = !cropMode;
                consume(e);
                break;
            case 'r':
                resetFilters();
                consume(e);
                break;
            case 'b':
            case ' ':
                showOriginal = !showOriginal;
                consume(e);
                break;
            case '[':
                filters = {
                    ...filters,
                    rotate: (((filters.rotate - 90) % 360) + 360) % 360,
                };
                consume(e);
                break;
            case ']':
                filters = {
                    ...filters,
                    rotate: (((filters.rotate + 90) % 360) + 360) % 360,
                };
                consume(e);
                break;
            case 'f':
                filters = {...filters, flipH: !filters.flipH};
                consume(e);
                break;
            case 'v':
                filters = {...filters, flipV: !filters.flipV};
                consume(e);
                break;
        }
    }

    $effect(() => {
        if (open && modalEl) modalEl.focus();
    });
</script>

{#if open}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
        class="fixed inset-0 z-50 flex flex-col bg-black outline-none"
        bind:this={modalEl}
        tabindex="0"
        onkeydown={handleKeydown}
    >
        <!-- Top toolbar -->
        <div
            class="border-border bg-bg-secondary flex h-11 shrink-0 items-center justify-between border-b px-5"
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
            <div class="flex items-center gap-1">
                <!-- Undo / Redo -->
                <button
                    type="button"
                    class="text-fg-dimmed hover:text-fg-primary flex h-7 w-7 items-center justify-center transition-colors disabled:opacity-30"
                    onclick={handleUndo}
                    disabled={!canUndo}
                    title="Undo filter change ( Ctrl+Z )"
                    aria-label="Undo"
                >
                    <svg
                        viewBox="0 0 16 16"
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M4 4v4h4" />
                        <path d="M4 8a6 6 0 1 1 2 4.5" />
                    </svg>
                </button>
                <button
                    type="button"
                    class="text-fg-dimmed hover:text-fg-primary flex h-7 w-7 items-center justify-center transition-colors disabled:opacity-30"
                    onclick={handleRedo}
                    disabled={!canRedo}
                    title="Redo filter change ( Ctrl+Shift+Z )"
                    aria-label="Redo"
                >
                    <svg
                        viewBox="0 0 16 16"
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M12 4v4h-4" />
                        <path d="M12 8a6 6 0 1 0 -2 4.5" />
                    </svg>
                </button>

                <span class="bg-border mx-2 h-4 w-px"></span>

                <!-- Before/After toggle -->
                <button
                    type="button"
                    class="flex h-7 items-center gap-1.5 px-2 text-[10px] font-medium transition-colors
                        {showOriginal
                        ? 'text-accent bg-accent/10'
                        : 'text-fg-dimmed hover:text-fg-primary'}"
                    onclick={() => (showOriginal = !showOriginal)}
                    disabled={!hasChanges}
                    title="Show original for comparison ( B or Space )"
                    aria-pressed={showOriginal}
                >
                    <svg
                        viewBox="0 0 16 16"
                        class="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.4"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <rect x="2" y="3" width="12" height="10" rx="1" />
                        <path d="M8 3v10" />
                        <path d="M4 6l2 2-2 2" />
                        <path d="M12 10l-2-2 2-2" />
                    </svg>
                    Before
                </button>

                <span class="bg-border mx-2 h-4 w-px"></span>

                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px] transition-colors"
                    onclick={resetFilters}
                    title="Reset all adjustments ( R )">Reset All</button
                >
                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-3 py-1.5 text-[11px] transition-colors"
                    onclick={onclose}
                    title="Cancel ( Esc )">Cancel</button
                >
                <button
                    class="bg-accent hover:bg-accent-hover px-5 py-1.5 text-[11px] font-medium text-[#111116] transition-colors disabled:opacity-40"
                    onclick={handleApply}
                    disabled={isProcessing || !hasChanges}
                    title="Apply and close ( Ctrl+Enter )"
                    >{isProcessing ? 'Exporting...' : 'Apply'}</button
                >
            </div>
        </div>

        <!-- Main content -->
        <div class="flex flex-1 overflow-hidden">
            <div class="bg-bg-primary flex flex-1 flex-col">
                <!-- svelte-ignore a11y_no_static_element_interactions -->
                <div
                    class="relative flex flex-1 items-center justify-center overflow-hidden p-6"
                    bind:this={previewAreaEl}
                    onmousedown={() => {
                        if (!cropMode && hasChanges) showOriginal = true;
                    }}
                    onmouseup={() => (showOriginal = false)}
                    onmouseleave={() => (showOriginal = false)}
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
                        <!-- Hidden image — decoded source used by filter canvas.
                             Must be in the DOM so onload fires. -->
                        <img
                            src={originalUrl}
                            alt=""
                            class="hidden"
                            onload={handleImageLoad}
                        />

                        <!-- Original <img> (before or passthrough). Always
                             mounted so it keeps a stable layout size for the
                             crop overlay; hidden when the canvas should show. -->
                        <img
                            bind:this={displayImgEl}
                            src={originalUrl}
                            alt="Preview"
                            width={naturalWidth || undefined}
                            height={naturalHeight || undefined}
                            class="max-h-full max-w-full select-none object-contain"
                            class:hidden={showCanvas}
                            style="filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5))"
                            draggable="false"
                        />

                        <!-- Filtered preview canvas — written to directly by
                             renderToCanvas, no dataURL round-trip. -->
                        <canvas
                            bind:this={previewCanvasEl}
                            class="max-h-full max-w-full select-none object-contain"
                            class:hidden={!showCanvas}
                            style="filter: drop-shadow(0 4px 24px rgba(0,0,0,0.5))"
                        ></canvas>

                        <!-- Crop overlay -->
                        {#if cropMode && imgReady && displayImgEl && previewAreaEl}
                            <CropOverlay
                                imgEl={displayImgEl}
                                containerEl={previewAreaEl}
                                cropX={filters.cropX}
                                cropY={filters.cropY}
                                cropW={filters.cropW}
                                cropH={filters.cropH}
                                aspectRatio={cropAspectRatio}
                                {naturalWidth}
                                {naturalHeight}
                                oncrop={handleCropChange}
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
                    class="border-border bg-bg-secondary flex items-center justify-between gap-4 border-t px-5 py-2"
                >
                    <span class="text-fg-dimmed text-[10px]">
                        {#if showOriginal}
                            Showing Original
                        {:else if cropMode}
                            Drag corners to crop · Drag inside to move · Esc to
                            exit
                        {:else}
                            Hold image to compare · B / Space toggle · C crop ·
                            [ ] rotate · Ctrl+Z undo
                        {/if}
                    </span>
                    {#if naturalWidth > 0}
                        <span
                            class="text-fg-dimmed font-mono text-[10px] tabular-nums"
                        >
                            {naturalWidth} × {naturalHeight}
                        </span>
                    {/if}
                </div>
            </div>

            <div
                class="border-border bg-bg-secondary flex w-72 flex-col border-l"
            >
                <FilterControls
                    bind:filters
                    bind:cropMode
                    onpreview={noopPreview}
                    {cropAspectRatio}
                    oncropaspectratio={r => (cropAspectRatio = r)}
                    {naturalWidth}
                    {naturalHeight}
                    {histogram}
                    {imgEl}
                />
            </div>
        </div>
    </div>
{/if}
