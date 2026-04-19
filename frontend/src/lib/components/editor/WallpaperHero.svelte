<script lang="ts">
    import {
        getWallpaperPath,
        getIsExtracting,
        setIsExtracting,
        setPalette,
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

    let {onedit}: {onedit?: () => void} = $props();

    let wallpaperImage = $derived(getCachedFullImage(getWallpaperPath()) || '');
    let loading = $derived(isPending(getWallpaperPath()));
    let isVideo = $derived(isVideoSource(wallpaperImage));
    let previewOpen = $state(false);
    let eyedropperActive = $derived(getEyedropperActive());

    let imgEl = $state<HTMLImageElement | null>(null);
    let videoEl = $state<HTMLVideoElement | null>(null);

    const LOUPE_SAMPLES = 11; // odd so one pixel is dead-center
    const LOUPE_ZOOM = 10;
    const LOUPE_SIZE = LOUPE_SAMPLES * LOUPE_ZOOM;
    let loupeCanvas = $state<HTMLCanvasElement | null>(null);
    let loupeVisible = $state(false);
    let loupeX = $state(0);
    let loupeY = $state(0);
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

        // object-cover scales to max(containerW/W, containerH/H) and center-crops.
        const scale = Math.max(rect.width / naturalW, rect.height / naturalH);
        const offsetX = (rect.width - naturalW * scale) / 2;
        const offsetY = (rect.height - naturalH * scale) / 2;
        const srcX = Math.max(
            0,
            Math.min(
                naturalW - 1,
                Math.floor((e.clientX - rect.left - offsetX) / scale)
            )
        );
        const srcY = Math.max(
            0,
            Math.min(
                naturalH - 1,
                Math.floor((e.clientY - rect.top - offsetY) / scale)
            )
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
            setPalette(colors);
            showToast('Colors extracted');
        } catch {
            showToast('Failed to extract colors');
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
            setPalette(result.palette);
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
        class="bg-bg-surface border-border flex h-96 w-full items-center justify-center overflow-hidden border"
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
                class="h-full w-full object-cover"
            ></video>
        {:else if wallpaperImage}
            <img
                bind:this={imgEl}
                src={wallpaperImage}
                alt="Current wallpaper"
                class="h-full w-full object-cover"
            />
        {:else}
            <span class="text-fg-dimmed text-[11px]">No preview available</span>
        {/if}

        {#if getIsExtracting()}
            <div
                class="absolute inset-0 flex items-center justify-center bg-black/60"
            >
                <span class="text-[11px] text-white">Extracting colors...</span>
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
            class="absolute bottom-0 left-0 right-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3"
        >
            <button
                class="bg-accent hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors duration-100"
                onclick={handleExtractColors}>Extract</button
            >
            {#if getAdditionalImages().length > 0}
                <button
                    class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                    onclick={handleExtractAll}
                    title="Blend palette from main wallpaper and all additional images"
                    >Extract All</button
                >
            {/if}
            {#if wallpaperImage}
                <button
                    class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                    onclick={() => (previewOpen = true)}>View</button
                >
            {/if}
            {#if onedit}
                <button
                    class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                    onclick={onedit}>Edit</button
                >
            {/if}
            <button
                class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                onclick={handleChange}>Change</button
            >
        </div>
    {/if}
</div>

{#if eyedropperActive}
    <div
        class="pointer-events-none fixed z-50 transition-opacity"
        class:opacity-0={!loupeVisible}
        style:left="{loupeX + 20}px"
        style:top="{loupeY + 20}px"
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
