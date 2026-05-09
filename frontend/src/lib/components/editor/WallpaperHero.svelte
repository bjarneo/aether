<script lang="ts">
    import {
        getWallpaperPath,
        getIsExtracting,
        setIsExtracting,
        setPaletteFromExtraction,
        setWallpaperPath,
        setColor,
        setExtendedColor,
        setAppOverride,
        getLightMode,
        getExtractionMode,
        setAdjustments,
        getAdditionalImages,
    } from '$lib/stores/theme.svelte';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';
    import {
        showToast,
        getEyedropperActive,
        setEyedropperActive,
        getColorPickerIndex,
        getColorPickerExtKey,
        getColorPickerOverrideApp,
        getColorPickerOverrideRole,
    } from '$lib/stores/ui.svelte';
    import {
        getCachedFullImage,
        loadFullImage,
        isPending,
        isVideoSource,
    } from '$lib/stores/imagecache.svelte';
    import ImagePreview from '$lib/components/shared/ImagePreview.svelte';

    let {onedit, expanded = false}: {onedit?: () => void; expanded?: boolean} =
        $props();

    let wallpaperPath = $derived(getWallpaperPath());
    let wallpaperImage = $derived(getCachedFullImage(wallpaperPath) || '');
    let wallpaperName = $derived(wallpaperPath.split('/').pop() || '');
    let loading = $derived(isPending(wallpaperPath));
    let isVideo = $derived(isVideoSource(wallpaperImage));
    let previewOpen = $state(false);
    let eyedropperActive = $derived(getEyedropperActive());
    let containerHeight = $derived(expanded ? 'h-[70vh]' : 'h-96');
    let objectFit = $derived(expanded ? 'object-contain' : 'object-cover');
    let extraCount = $derived(getAdditionalImages().length);
    let extracting = $derived(getIsExtracting());

    let imgEl = $state<HTMLImageElement | null>(null);
    let videoEl = $state<HTMLVideoElement | null>(null);

    const LOUPE_SAMPLES = 11; // odd so one pixel is dead-center
    const LOUPE_ZOOM = 10;
    const LOUPE_SIZE = LOUPE_SAMPLES * LOUPE_ZOOM;
    const LOUPE_MARGIN = 20;
    const LOUPE_HEX_STRIP = 20; // approx height of hex readout strip
    let loupeCanvas = $state<HTMLCanvasElement | null>(null);
    let loupeVisible = $state(false);
    let loupeX = $state(0);
    let loupeY = $state(0);
    let loupeFlipX = $state(false);
    let loupeFlipY = $state(false);
    let loupeHex = $state('#000000');

    $effect(() => {
        const path = getWallpaperPath();
        if (path && !getCachedFullImage(path)) {
            loadFullImage(path);
        }
    });

    $effect(() => {
        if (!eyedropperActive) loupeVisible = false;
    });

    function applySampledColor(hex: string) {
        const overrideApp = getColorPickerOverrideApp();
        const overrideRole = getColorPickerOverrideRole();
        const extKey = getColorPickerExtKey();
        if (overrideApp && overrideRole) {
            setAppOverride(overrideApp, overrideRole, hex);
        } else if (extKey) {
            setExtendedColor(extKey, hex);
        } else {
            setColor(getColorPickerIndex(), hex);
        }
    }

    type SourceCoords = {
        source: HTMLImageElement | HTMLVideoElement;
        srcX: number;
        srcY: number;
        naturalW: number;
        naturalH: number;
    };

    function mapEventToSource(e: MouseEvent): SourceCoords | null {
        const source: HTMLImageElement | HTMLVideoElement | null = isVideo
            ? videoEl
            : imgEl;
        if (!source) return null;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const naturalW =
            source instanceof HTMLVideoElement
                ? source.videoWidth
                : source.naturalWidth;
        const naturalH =
            source instanceof HTMLVideoElement
                ? source.videoHeight
                : source.naturalHeight;
        if (!naturalW || !naturalH) return null;

        // CSS `zoom` on <html> scales getBoundingClientRect() but not e.clientX/Y
        // on webkit2gtk — normalize rect into the same space as the mouse coords.
        const zoom = parseFloat(document.documentElement.style.zoom) || 1;
        const rectLeft = rect.left / zoom;
        const rectTop = rect.top / zoom;
        const rectWidth = rect.width / zoom;
        const rectHeight = rect.height / zoom;

        // object-cover uses max (crop-fill), object-contain uses min (letterbox).
        const scale = expanded
            ? Math.min(rectWidth / naturalW, rectHeight / naturalH)
            : Math.max(rectWidth / naturalW, rectHeight / naturalH);
        const offsetX = (rectWidth - naturalW * scale) / 2;
        const offsetY = (rectHeight - naturalH * scale) / 2;
        const localX = e.clientX - rectLeft - offsetX;
        const localY = e.clientY - rectTop - offsetY;

        // In contain mode, clicks on the letterbox lie outside the image — bail.
        if (
            expanded &&
            (localX < 0 ||
                localY < 0 ||
                localX >= naturalW * scale ||
                localY >= naturalH * scale)
        ) {
            return null;
        }

        const srcX = Math.max(
            0,
            Math.min(naturalW - 1, Math.floor(localX / scale))
        );
        const srcY = Math.max(
            0,
            Math.min(naturalH - 1, Math.floor(localY / scale))
        );
        return {source, srcX, srcY, naturalW, naturalH};
    }

    function handleSampleMove(e: MouseEvent) {
        if (!eyedropperActive || !loupeCanvas) return;
        const mapped = mapEventToSource(e);
        if (!mapped) return;

        const ctx = loupeCanvas.getContext('2d', {willReadFrequently: true});
        if (!ctx) return;
        ctx.imageSmoothingEnabled = false;

        const half = Math.floor(LOUPE_SAMPLES / 2);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
        try {
            ctx.drawImage(
                mapped.source,
                mapped.srcX - half,
                mapped.srcY - half,
                LOUPE_SAMPLES,
                LOUPE_SAMPLES,
                0,
                0,
                LOUPE_SIZE,
                LOUPE_SIZE
            );
            const center = Math.floor(LOUPE_SIZE / 2);
            const [r, g, b] = ctx.getImageData(center, center, 1, 1).data;
            loupeHex =
                '#' +
                [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        } catch {
            return;
        }

        loupeX = e.clientX;
        loupeY = e.clientY;
        // Flip loupe to the opposite side of the cursor when near the viewport
        // edge, so the loupe + hex strip stay fully visible.
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        loupeFlipX = e.clientX + LOUPE_MARGIN + LOUPE_SIZE + 4 > vw;
        loupeFlipY =
            e.clientY + LOUPE_MARGIN + LOUPE_SIZE + LOUPE_HEX_STRIP > vh;
        loupeVisible = true;
    }

    function handleSampleLeave() {
        loupeVisible = false;
    }

    function handleSample(e: MouseEvent) {
        if (!eyedropperActive) return;
        const mapped = mapEventToSource(e);
        if (!mapped) return;

        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        try {
            ctx.drawImage(
                mapped.source,
                mapped.srcX,
                mapped.srcY,
                1,
                1,
                0,
                0,
                1,
                1
            );
            const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
            const hex =
                '#' +
                [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
            applySampledColor(hex);
            showToast(`Picked ${hex}`);
        } catch {
            showToast('Failed to sample pixel');
        } finally {
            setEyedropperActive(false);
        }
    }

    async function handleExtractColors() {
        const path = getWallpaperPath();
        if (!path) return;
        setIsExtracting(true);
        try {
            const {ExtractColors} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const colors = await ExtractColors(
                path,
                getLightMode(),
                getExtractionMode()
            );
            setAdjustments({...DEFAULT_ADJUSTMENTS});
            setPaletteFromExtraction(path, colors);
            showToast('Colors extracted');
        } catch {
            showToast('Couldn’t extract colors from that image');
        } finally {
            setIsExtracting(false);
        }
    }

    async function handleExtractAll() {
        const paths = [getWallpaperPath(), ...getAdditionalImages()].filter(
            p => !!p
        );
        if (paths.length === 0) return;
        setIsExtracting(true);
        try {
            const {ExtractColorsFromImages} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ExtractColorsFromImages(
                paths,
                getLightMode(),
                getExtractionMode()
            );
            setAdjustments({...DEFAULT_ADJUSTMENTS});
            // Treat the primary wallpaper as the extraction source for the
            // override-clear heuristic. Blends switch context too, so this
            // matches the single-image behaviour.
            setPaletteFromExtraction(paths[0], result.palette);
            const used = paths.length - result.skipped;
            const suffix =
                result.skipped > 0 ? ` (${result.skipped} skipped)` : '';
            showToast(
                `Blended palette from ${used} image${used === 1 ? '' : 's'}${suffix}`
            );
        } catch {
            showToast('Failed to blend colors');
        } finally {
            setIsExtracting(false);
        }
    }

    async function handleChange() {
        try {
            const {OpenFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const path = await OpenFileDialog();
            if (path) {
                setWallpaperPath(path);
                showToast(
                    'Wallpaper changed — click Extract to generate palette'
                );
            }
        } catch {
            showToast('Failed to change wallpaper');
        }
    }
</script>

<div class="group relative">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div
        class="bg-bg-surface border-border flex w-full items-center justify-center overflow-hidden border transition-[height] duration-200 {containerHeight}"
        class:cursor-crosshair={eyedropperActive}
        onclick={handleSample}
        onmousemove={handleSampleMove}
        onmouseleave={handleSampleLeave}
    >
        {#if loading}
            <span class="text-fg-dimmed text-[11px]">Loading preview...</span>
        {:else if wallpaperImage && isVideo}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
                bind:this={videoEl}
                src={wallpaperImage}
                autoplay
                loop
                muted
                playsinline
                crossorigin="anonymous"
                class="h-full w-full {objectFit}"
            ></video>
        {:else if wallpaperImage}
            <img
                bind:this={imgEl}
                src={wallpaperImage}
                alt="Current wallpaper"
                class="h-full w-full {objectFit}"
            />
        {:else}
            <span class="text-fg-dimmed text-[11px]">No preview available</span>
        {/if}

        {#if extracting}
            <div
                class="absolute inset-0 flex items-center justify-center bg-black/60"
            >
                <span class="text-[11px] text-white">Extracting colors…</span>
            </div>
        {/if}

        {#if eyedropperActive}
            <div
                class="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 bg-black/70 px-3 py-1 text-[11px] font-medium text-white"
            >
                Click to pick a color · Esc to cancel
            </div>
        {/if}
    </div>

    {#if !eyedropperActive}
        <div
            class="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/65 to-transparent p-2.5"
        >
            <span
                class="pointer-events-auto truncate font-mono text-[10px] text-white/70"
                style="text-shadow: 0 1px 2px rgba(0,0,0,0.6);"
                title={wallpaperPath}
            >
                {wallpaperName}
            </span>

            <div class="pointer-events-auto flex shrink-0 items-center gap-1">
                {#if wallpaperImage}
                    <button
                        class="flex h-7 w-7 items-center justify-center text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                        onclick={() => (previewOpen = true)}
                        title="View full-size"
                        aria-label="View full-size"
                    >
                        <svg
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                            ></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                {/if}
                {#if onedit}
                    <button
                        class="flex h-7 w-7 items-center justify-center text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                        onclick={onedit}
                        title="Edit — crop, adjust, filters"
                        aria-label="Edit wallpaper"
                    >
                        <svg
                            class="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path
                                d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                            ></path>
                        </svg>
                    </button>
                {/if}
                <button
                    class="flex h-7 w-7 items-center justify-center text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                    onclick={handleChange}
                    title="Change wallpaper"
                    aria-label="Change wallpaper"
                >
                    <svg
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path>
                        <polyline points="21 3 21 8 16 8"></polyline>
                    </svg>
                </button>

                <span class="mx-1 h-5 w-px bg-white/20"></span>

                {#if extraCount > 0}
                    <button
                        class="bg-white/15 px-3 py-1 text-[11px] font-medium text-white transition-colors hover:bg-white/25 disabled:opacity-50"
                        onclick={handleExtractAll}
                        disabled={extracting}
                        title="Blend palette from main + {extraCount} additional image{extraCount ===
                        1
                            ? ''
                            : 's'}"
                    >
                        Extract All
                        <span class="text-white/60">· {1 + extraCount}</span>
                    </button>
                {/if}
                <button
                    class="bg-accent hover:bg-accent-hover px-3 py-1 text-[11px] font-medium text-[#111116] transition-colors disabled:opacity-50"
                    onclick={handleExtractColors}
                    disabled={extracting}
                    title="Extract a 16-color palette from this wallpaper"
                >
                    Extract
                </button>
            </div>
        </div>
    {/if}
</div>

{#if eyedropperActive}
    <div
        class="pointer-events-none fixed z-50 transition-opacity"
        class:opacity-0={!loupeVisible}
        style:left="{loupeFlipX
            ? loupeX - LOUPE_MARGIN - LOUPE_SIZE - 4
            : loupeX + LOUPE_MARGIN}px"
        style:top="{loupeFlipY
            ? loupeY - LOUPE_MARGIN - LOUPE_SIZE - LOUPE_HEX_STRIP
            : loupeY + LOUPE_MARGIN}px"
    >
        <div class="relative">
            <canvas
                bind:this={loupeCanvas}
                width={LOUPE_SIZE}
                height={LOUPE_SIZE}
                class="border-fg-primary block border-2 shadow-lg"
            ></canvas>
            <div
                class="border-fg-primary pointer-events-none absolute left-1/2 top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 border"
            ></div>
        </div>
        <div
            class="border-fg-primary bg-bg-secondary text-fg-primary flex items-center justify-center gap-1.5 border-x-2 border-b-2 px-2 py-0.5 font-mono text-[10px] font-medium"
        >
            <span
                class="border-border inline-block h-2.5 w-2.5 border"
                style:background-color={loupeHex}
            ></span>
            {loupeHex.toUpperCase()}
        </div>
    </div>
{/if}

<ImagePreview
    src={wallpaperImage}
    alt="Wallpaper"
    open={previewOpen}
    onclose={() => (previewOpen = false)}
/>
