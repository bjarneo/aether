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

    let _appModule: Awaited<
        typeof import('../../../../wailsjs/go/main/App')
    > | null = null;
    async function getApp() {
        if (!_appModule) {
            _appModule = await import('../../../../wailsjs/go/main/App');
        }
        return _appModule;
    }

    interface SlideItem {
        path: string;
        name: string;
        imagePath: string;
        colors?: string[];
    }

    let {
        onclose,
        mode = 'wallpapers',
    }: {onclose?: () => void; mode?: 'wallpapers' | 'themes'} = $props();

    let allItems = $state<SlideItem[]>([]);
    let items = $state<SlideItem[]>([]);
    let currentIndex = $state(0);
    let isLoading = $state(true);
    let ready = $state(false);
    let isCaching = $state(false);
    let cacheProgress = $state(0);
    let cacheTotal = $state(0);
    let isExtracting = $state(false);
    let extractedPalette = $state<string[]>([]);
    let accentColor = $derived(extractedPalette[4] ?? '#89b4fa');
    let extractionGen = 0;
    let extractTimer: ReturnType<typeof setTimeout> | null = null;

    let tabHoldStart = 0;
    let tabRepeatTimer: ReturnType<typeof setInterval> | null = null;
    let isRapidNav = false;

    let searchQuery = $state('');
    let searchVisible = $derived(searchQuery.length > 0);

    let container: HTMLDivElement | undefined = $state();
    let areaWidth = $state(0);

    const CARD_WIDTH = 180;
    const CARD_GAP = 20;
    const CARD_STEP = CARD_WIDTH + CARD_GAP;
    const CARD_MAX_HEIGHT = 250;
    const SKEW = 5;
    const EXTRACT_DEBOUNCE = 300;
    const BUFFER = 3;

    let trackOffset = $derived(
        areaWidth / 2 - currentIndex * CARD_STEP - CARD_WIDTH / 2
    );

    let visibleRange = $derived.by(() => {
        if (!areaWidth || items.length === 0) return {start: 0, end: 0};
        const halfViewport = areaWidth / 2;
        const cardsInHalf = Math.ceil(halfViewport / CARD_STEP) + 1;
        const start = Math.max(0, currentIndex - cardsInHalf - BUFFER);
        const end = Math.min(
            items.length,
            currentIndex + cardsInHalf + BUFFER + 1
        );
        return {start, end};
    });

    let visibleSlides = $derived(
        items.slice(visibleRange.start, visibleRange.end)
    );

    let spacerWidth = $derived(visibleRange.start * CARD_STEP);

    let normalColors = $derived(extractedPalette.slice(0, 8));
    let brightColors = $derived(extractedPalette.slice(8, 16));

    async function warmCache(paths: string[]) {
        const app = await getApp();

        const cached = await Promise.all(
            paths.map(p => app.IsPreviewCached(p).catch(() => false))
        );
        const uncached = paths.filter((_, i) => !cached[i]);

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
                    await app.GetPreview(uncached[i]);
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

    async function loadWallpapers(): Promise<SlideItem[]> {
        const app = await getApp();
        const wps = await app.ScanLocalWallpapers();
        return wps.map(wp => ({
            path: wp.path,
            name: wp.name,
            imagePath: wp.path,
        }));
    }

    function pickPrimaryWallpaper(wallpapers: string[]): string {
        if (!wallpapers?.length) return '';
        for (const prefix of ['0-', '1-', '2-']) {
            const match = wallpapers.find(wp => {
                const name = wp.split('/').pop() ?? '';
                return name.startsWith(prefix);
            });
            if (match) return match;
        }
        return wallpapers[0];
    }

    async function loadThemes(): Promise<SlideItem[]> {
        const app = await getApp();
        const themes = await app.LoadOmarchyThemes();
        if (!Array.isArray(themes)) return [];
        return themes
            .filter(t => t.colors?.length >= 16)
            .map(t => ({
                path: t.path,
                name: t.name,
                imagePath: pickPrimaryWallpaper(t.wallpapers),
                colors: t.colors,
            }));
    }

    onMount(async () => {
        document.documentElement.classList.add('transparent-widget');

        try {
            const {WindowShow, WindowSetSize, WindowSetPosition, ScreenGetAll} =
                await import('../../../../wailsjs/runtime/runtime');
            const screens = await ScreenGetAll();
            const current =
                screens.find(s => s.isCurrent) ??
                screens.find(s => s.isPrimary) ??
                screens[0];
            if (current) {
                WindowSetSize(current.width, current.height);
                WindowSetPosition(0, 0);
            }
            WindowShow();
            requestAnimationFrame(() => {
                ready = true;
            });
        } catch {}

        try {
            allItems =
                mode === 'themes' ? await loadThemes() : await loadWallpapers();
            items = [...allItems];
        } catch {
            allItems = [];
            items = [];
        } finally {
            isLoading = false;
        }

        if (items.length > 0) {
            const imagePaths = items.map(it => it.imagePath).filter(Boolean);
            if (imagePaths.length > 0) {
                await warmCache(imagePaths);
            }
            preloadAround(0);
            selectItem(0);
        }

        requestAnimationFrame(() => container?.focus());
    });

    onDestroy(() => {
        if (extractTimer) clearTimeout(extractTimer);
        stopTabHold();
        previewDataUrls = {};
    });

    function preloadAround(idx: number) {
        for (let d = -BUFFER; d <= BUFFER; d++) {
            const i = idx + d;
            if (i >= 0 && i < items.length && items[i].imagePath) {
                loadPreview(items[i].imagePath);
            }
        }
    }

    function selectItem(idx: number) {
        const item = items[idx];
        if (!item) return;

        if (mode === 'themes' && item.colors) {
            setPalette(item.colors, true);
            extractedPalette = [...item.colors];
            if (item.imagePath) setWallpaperPath(item.imagePath);
        } else {
            extractForIndex(idx);
        }
    }

    async function extractForIndex(idx: number) {
        const item = items[idx];
        if (!item) return;

        const gen = ++extractionGen;
        isExtracting = true;
        setWallpaperPath(item.imagePath);

        try {
            const app = await getApp();
            const colors: string[] = await app.ExtractColors(
                item.imagePath,
                getLightMode(),
                'normal'
            );
            if (gen !== extractionGen) return;
            setAdjustments({...DEFAULT_ADJUSTMENTS});
            setPalette(colors);
            extractedPalette = [...colors];
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
        extractTimer = setTimeout(() => selectItem(idx), EXTRACT_DEBOUNCE);
    }

    function goTo(idx: number) {
        if (idx < 0 || idx >= items.length) return;
        currentIndex = idx;
        if (isRapidNav) {
            if (mode === 'themes') selectItem(idx);
            return;
        }
        preloadAround(idx);
        if (mode === 'themes') {
            selectItem(idx);
        } else {
            debouncedExtract(idx);
        }
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

    function applySearchFilter() {
        if (!searchQuery) {
            resetSearch();
            return;
        }
        const q = searchQuery.toLowerCase();
        items = allItems.filter(it => it.name.toLowerCase().includes(q));
        if (items.length > 0) {
            goTo(0);
        } else {
            currentIndex = 0;
        }
    }

    function resetSearch() {
        const currentItem = items[currentIndex];
        searchQuery = '';
        items = [...allItems];
        if (currentItem) {
            const idx = items.findIndex(it => it.path === currentItem.path);
            currentIndex = idx >= 0 ? idx : 0;
        } else {
            currentIndex = 0;
        }
        goTo(currentIndex);
    }

    function startTabHold(dir: number) {
        tabHoldStart = Date.now();
        isRapidNav = true;
        goTo(currentIndex + dir);
        tabRepeatTimer = setInterval(() => {
            const held = Date.now() - tabHoldStart;
            const step = held > 1500 ? 5 : held > 800 ? 3 : 1;
            goTo(currentIndex + dir * step);
        }, 120);
    }

    function stopTabHold() {
        if (tabRepeatTimer) {
            clearInterval(tabRepeatTimer);
            tabRepeatTimer = null;
        }
        if (isRapidNav) {
            isRapidNav = false;
            preloadAround(currentIndex);
            selectItem(currentIndex);
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (searchVisible && e.key === 'Escape') {
            e.preventDefault();
            resetSearch();
            return;
        }

        if (searchVisible && e.key === 'Backspace') {
            e.preventDefault();
            searchQuery = searchQuery.slice(0, -1);
            if (!searchQuery) resetSearch();
            else applySearchFilter();
            return;
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            if (e.repeat) return;
            startTabHold(e.shiftKey ? -1 : 1);
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
        } else if (
            e.key.length === 1 &&
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey
        ) {
            e.preventDefault();
            searchQuery += e.key;
            applySearchFilter();
        }
    }

    function handleKeyup(e: KeyboardEvent) {
        if (e.key === 'Tab') {
            stopTabHold();
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
    style="background: transparent; opacity: {ready
        ? 1
        : 0}; transition: opacity 0.15s ease"
    tabindex="-1"
    role="listbox"
    aria-label="{mode === 'themes' ? 'Theme' : 'Wallpaper'} slider"
    onkeydown={handleKeydown}
    onkeyup={handleKeyup}
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
    {:else if !isLoading && items.length > 0}
        <div
            class="flex w-full items-center overflow-hidden"
            style="height: {CARD_MAX_HEIGHT + 50}px"
            bind:clientWidth={areaWidth}
        >
            <div
                class="flex items-center"
                style="
                    transform: translateX({trackOffset}px);
                    transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    will-change: transform;
                    gap: {CARD_GAP}px;
                "
            >
                {#if spacerWidth > 0}
                    <div
                        class="shrink-0"
                        style="width: {spacerWidth - CARD_GAP}px"
                    ></div>
                {/if}

                {#each visibleSlides as item, vi (item.path)}
                    {@const i = visibleRange.start + vi}
                    <button
                        class="relative shrink-0 overflow-hidden border-2"
                        style="
                            width: {i === currentIndex
                            ? CARD_WIDTH + 20
                            : CARD_WIDTH}px;
                            height: {i === currentIndex
                            ? CARD_MAX_HEIGHT + 30
                            : CARD_MAX_HEIGHT}px;
                            transform: skewX(-{SKEW}deg);
                            opacity: {slideOpacity(i)};
                            transition: opacity 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
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
                        {#if item.imagePath && previewDataUrls[item.imagePath]}
                            <img
                                src={previewDataUrls[item.imagePath]}
                                alt={item.name}
                                class="pointer-events-none h-full w-full object-cover"
                                style="transform: skewX({SKEW}deg) scale(1.15)"
                            />
                        {:else if item.colors}
                            <div
                                class="flex h-full w-full flex-wrap"
                                style="transform: skewX({SKEW}deg) scale(1.15)"
                            >
                                {#each item.colors.slice(0, 8) as c}
                                    <div
                                        class="h-1/2"
                                        style="width: 25%; background: {c}"
                                    ></div>
                                {/each}
                                {#each item.colors.slice(8, 16) as c}
                                    <div
                                        class="h-1/2"
                                        style="width: 25%; background: {c}"
                                    ></div>
                                {/each}
                            </div>
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
                        {#if mode === 'themes'}
                            <div
                                class="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center pb-4"
                                style="
                                    background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
                                    transform: skewX({SKEW}deg);
                                    padding-top: 40px;
                                "
                            >
                                <span
                                    style="
                                        font-family: 'JetBrains Mono', monospace;
                                        font-size: 13px;
                                        color: rgba(255,255,255,0.85);
                                        letter-spacing: 0.04em;
                                    "
                                >
                                    {item.name}
                                </span>
                            </div>
                        {/if}
                    </button>
                {/each}
            </div>
        </div>

        {#if searchVisible}
            <div
                class="mt-4 flex items-center gap-2"
                style="background: rgba(0,0,0,0.5); padding: 4px 12px;"
            >
                <span style="color: rgba(255,255,255,0.4); font-size: 10px">
                    /
                </span>
                <span style="color: rgba(255,255,255,0.8); font-size: 11px">
                    {searchQuery}
                </span>
                <span
                    class="animate-pulse"
                    style="color: rgba(255,255,255,0.5); font-size: 11px"
                    >|</span
                >
            </div>
        {/if}

        <div class="mt-4 flex flex-col items-center gap-2">
            <div class="flex flex-col gap-[2px]">
                <div class="flex gap-[2px]">
                    {#each normalColors as color}
                        <div
                            class="h-3 w-6"
                            style="background: {color}; transition: background 0.5s ease"
                        ></div>
                    {/each}
                </div>
                <div class="flex gap-[2px]">
                    {#each brightColors as color}
                        <div
                            class="h-3 w-6"
                            style="background: {color}; transition: background 0.5s ease"
                        ></div>
                    {/each}
                </div>
            </div>
            <span
                style="color: rgba(255,255,255,0.2); font-size: 9px; letter-spacing: 0.08em"
            >
                {items[currentIndex]?.name ?? ''}
            </span>
        </div>
    {/if}
</div>
