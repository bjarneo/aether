<script lang="ts">
    import {onMount, onDestroy} from 'svelte';
    import {
        setWallpaperPath,
        setPalette,
        setAdjustments,
        getIsApplying,
        setIsApplying,
        getPalette,
        getWallpaperPath,
        getLightMode,
        getAdditionalImages,
        getExtendedColors,
        getAppOverrides,
    } from '$lib/stores/theme.svelte';
    import {getSettings} from '$lib/stores/settings.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';
    let previewDataUrls = $state<Record<string, string>>({});
    let previewPending = new Set<string>();

    async function loadPreview(path: string) {
        if (previewDataUrls[path] || previewPending.has(path)) return;
        previewPending.add(path);
        try {
            const app = await getApp();
            const previewPath = await app.GetPreview(path);
            const dataUrl = await app.ReadImageAsDataURL(previewPath);
            previewDataUrls = {...previewDataUrls, [path]: dataUrl};
        } catch {}
        previewPending.delete(path);
    }

    // Cache the dynamic import to avoid repeated async overhead
    let _appModule: Awaited<
        typeof import('../../../../wailsjs/go/main/App')
    > | null = null;
    async function getApp() {
        if (!_appModule) {
            _appModule = await import('../../../../wailsjs/go/main/App');
        }
        return _appModule;
    }

    interface WallpaperEntry {
        path: string;
        name: string;
        size: number;
        modTime: number;
    }

    let {onclose}: {onclose?: () => void} = $props();

    let wallpapers = $state<WallpaperEntry[]>([]);
    let currentIndex = $state(0);
    let isLoading = $state(true);
    let isCaching = $state(false);
    let cacheProgress = $state(0);
    let cacheTotal = $state(0);
    let isExtracting = $state(false);
    let accentColor = $state('#89b4fa');
    let extractedPalette = $state<string[]>([]);
    let extractionGen = 0;
    let extractTimer: ReturnType<typeof setTimeout> | null = null;

    let container: HTMLDivElement | undefined = $state();
    let areaWidth = $state(0);

    const CARD_WIDTH = 280;
    const CARD_GAP = 32;
    const CARD_STEP = CARD_WIDTH + CARD_GAP;
    const CARD_MAX_HEIGHT = 500;
    const SKEW = 5;
    const EXTRACT_DEBOUNCE = 300;
    const BUFFER = 3;

    let trackOffset = $derived(
        areaWidth / 2 - currentIndex * CARD_STEP - CARD_WIDTH / 2
    );

    let visibleRange = $derived.by(() => {
        if (!areaWidth || wallpapers.length === 0) return {start: 0, end: 0};
        const halfViewport = areaWidth / 2;
        const cardsInHalf = Math.ceil(halfViewport / CARD_STEP) + 1;
        const start = Math.max(0, currentIndex - cardsInHalf - BUFFER);
        const end = Math.min(
            wallpapers.length,
            currentIndex + cardsInHalf + BUFFER + 1
        );
        return {start, end};
    });

    let visibleSlides = $derived(
        wallpapers.slice(visibleRange.start, visibleRange.end)
    );

    let spacerWidth = $derived(visibleRange.start * CARD_STEP);

    let normalColors = $derived(extractedPalette.slice(0, 8));
    let brightColors = $derived(extractedPalette.slice(8, 16));

    async function warmCache(wps: WallpaperEntry[]) {
        const app = await getApp();

        // Batch check: parallelize all IsPreviewCached calls
        const cached = await Promise.all(
            wps.map(wp => app.IsPreviewCached(wp.path).catch(() => false))
        );
        const uncached = wps.filter((_, i) => !cached[i]);

        if (uncached.length === 0) return;

        const CONCURRENCY = 4;
        cacheTotal = uncached.length;
        cacheProgress = 0;
        isCaching = true;

        let idx = 0;
        async function next() {
            while (idx < uncached.length) {
                const i = idx++;
                try {
                    await app.GetPreview(uncached[i].path);
                } catch {}
                cacheProgress++;
            }
        }

        await Promise.all(
            Array.from({length: Math.min(CONCURRENCY, uncached.length)}, () =>
                next()
            )
        );
        isCaching = false;
    }

    onMount(async () => {
        document.documentElement.classList.add('transparent-widget');

        // Show the window now that background is transparent (started hidden to avoid white flash)
        try {
            const {WindowShow} = await import(
                '../../../../wailsjs/runtime/runtime'
            );
            WindowShow();
        } catch {}

        try {
            const app = await getApp();
            wallpapers = await app.ScanLocalWallpapers();
        } catch {
            wallpapers = [];
        } finally {
            isLoading = false;
        }

        if (wallpapers.length > 0) {
            await warmCache(wallpapers);
            preloadAround(0);
            extractForIndex(0);
        }

        requestAnimationFrame(() => container?.focus());
    });

    onDestroy(() => {
        if (extractTimer) clearTimeout(extractTimer);
        previewDataUrls = {};
    });

    function preloadAround(idx: number) {
        for (let d = -BUFFER; d <= BUFFER; d++) {
            const i = idx + d;
            if (i >= 0 && i < wallpapers.length) {
                loadPreview(wallpapers[i].path);
            }
        }
    }

    async function extractForIndex(idx: number) {
        const wp = wallpapers[idx];
        if (!wp) return;

        const gen = ++extractionGen;
        isExtracting = true;
        setWallpaperPath(wp.path);

        try {
            const app = await getApp();
            const colors: string[] = await app.ExtractColors(
                wp.path,
                getLightMode(),
                'material'
            );
            if (gen !== extractionGen) return;
            setAdjustments({...DEFAULT_ADJUSTMENTS});
            setPalette(colors);
            extractedPalette = [...colors];
            accentColor = colors[4];
        } catch {
            if (gen === extractionGen) {
                showToast('Color extraction failed');
            }
        } finally {
            if (gen === extractionGen) {
                isExtracting = false;
            }
        }
    }

    function debouncedExtract(idx: number) {
        if (extractTimer) clearTimeout(extractTimer);
        extractTimer = setTimeout(() => extractForIndex(idx), EXTRACT_DEBOUNCE);
    }

    function goTo(idx: number) {
        if (idx < 0 || idx >= wallpapers.length) return;
        currentIndex = idx;
        preloadAround(idx);
        debouncedExtract(idx);
    }

    async function applyTheme() {
        if (getIsApplying()) return;
        setIsApplying(true);
        try {
            const app = await getApp();
            const result = await app.ApplyTheme({
                palette: getPalette(),
                wallpaperPath: getWallpaperPath(),
                lightMode: getLightMode(),
                additionalImages: getAdditionalImages(),
                extendedColors: getExtendedColors(),
                settings: getSettings(),
                appOverrides: getAppOverrides(),
            });
            if (result.success) showToast('Theme applied');
        } catch {
            showToast('Failed to apply theme');
        } finally {
            setIsApplying(false);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Tab') {
            e.preventDefault();
            goTo(currentIndex + (e.shiftKey ? -1 : 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            applyTheme();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goTo(currentIndex + 1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goTo(currentIndex - 1);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onclose?.();
        }
    }

    function slideOpacity(i: number): number {
        const dist = Math.abs(i - currentIndex);
        if (dist === 0) return 1;
        if (dist === 1) return 0.55;
        if (dist === 2) return 0.3;
        return 0.15;
    }
</script>

<div
    bind:this={container}
    class="flex h-screen w-full flex-col items-center justify-center overflow-hidden outline-none"
    style="background: transparent"
    tabindex="-1"
    role="listbox"
    aria-label="Wallpaper slider"
    onkeydown={handleKeydown}
>
    {#if isCaching}
        <div class="flex flex-col items-center gap-3">
            <div
                class="h-[2px] w-64 overflow-hidden"
                style="background: rgba(255,255,255,0.08)"
            >
                <div
                    class="h-full"
                    style="
                        width: {cacheTotal > 0
                        ? (cacheProgress / cacheTotal) * 100
                        : 0}%;
                        background: {accentColor};
                        transition: width 0.15s ease;
                    "
                ></div>
            </div>
            <span style="color: rgba(255,255,255,0.3); font-size: 10px">
                Caching previews {cacheProgress}/{cacheTotal}
            </span>
        </div>
    {:else if !isLoading && wallpapers.length > 0}
        <div
            class="flex w-full items-center overflow-hidden"
            bind:clientWidth={areaWidth}
        >
            <div
                class="flex items-center"
                style="
                    transform: translateX({trackOffset}px);
                    transition: transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    gap: {CARD_GAP}px;
                "
            >
                {#if spacerWidth > 0}
                    <div
                        class="shrink-0"
                        style="width: {spacerWidth - CARD_GAP}px"
                    ></div>
                {/if}

                {#each visibleSlides as wp, vi (wp.path)}
                    {@const i = visibleRange.start + vi}
                    <button
                        class="shrink-0 overflow-hidden border-2"
                        style="
                            width: {i === currentIndex
                            ? CARD_WIDTH + 40
                            : CARD_WIDTH}px;
                            height: {i === currentIndex
                            ? CARD_MAX_HEIGHT + 60
                            : CARD_MAX_HEIGHT}px;
                            transform: skewX(-{SKEW}deg);
                            opacity: {slideOpacity(i)};
                            transition: opacity 0.4s ease, transform 0.4s ease, width 0.4s ease, height 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease;
                            border-color: {i === currentIndex
                            ? accentColor
                            : 'transparent'};
                            box-shadow: {i === currentIndex
                            ? `0 0 40px ${accentColor}30`
                            : 'none'};
                        "
                        tabindex="-1"
                        role="option"
                        aria-selected={i === currentIndex}
                        onclick={() => goTo(i)}
                    >
                        {#if previewDataUrls[wp.path]}
                            <img
                                src={previewDataUrls[wp.path]}
                                alt={wp.name}
                                class="pointer-events-none h-full w-full object-cover"
                                style="transform: skewX({SKEW}deg) scale(1.15)"
                            />
                        {:else}
                            <div
                                class="flex h-full w-full items-center justify-center"
                                style="background: rgba(255,255,255,0.05)"
                            >
                                <span
                                    style="color: rgba(255,255,255,0.3); font-size: 9px"
                                    >...</span
                                >
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        <div class="mt-6 flex flex-col items-center gap-2">
            <div
                class="flex items-center gap-[2px]"
                style="background: rgba(0,0,0,0.4); padding: 6px 8px;"
            >
                {#each normalColors as color}
                    <div
                        class="h-6 w-8"
                        style="background: {color}; transition: background 0.5s ease"
                    ></div>
                {/each}
                <div class="w-3"></div>
                {#each brightColors as color}
                    <div
                        class="h-6 w-8"
                        style="background: {color}; transition: background 0.5s ease"
                    ></div>
                {/each}
            </div>
            <span
                style="color: rgba(255,255,255,0.25); font-size: 10px; letter-spacing: 0.05em"
            >
                {wallpapers[currentIndex]?.name ?? ''}
            </span>
        </div>
    {/if}
</div>
