<script lang="ts">
    import {
        getWallpaperPath,
        getIsExtracting,
        setIsExtracting,
        setPalette,
        setWallpaperPath,
        getLightMode,
        getExtractionMode,
        setAdjustments,
    } from '$lib/stores/theme.svelte';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';
    import {showToast} from '$lib/stores/ui.svelte';
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

    $effect(() => {
        const path = getWallpaperPath();
        if (path && !getCachedFullImage(path)) {
            loadFullImage(path);
        }
    });

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
    <div
        class="bg-bg-surface border-border flex h-96 w-full items-center justify-center overflow-hidden border"
    >
        {#if loading}
            <span class="text-fg-dimmed text-[11px]">Loading preview...</span>
        {:else if wallpaperImage && isVideo}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video
                src={wallpaperImage}
                autoplay
                loop
                muted
                playsinline
                class="h-full w-full object-cover"
            ></video>
        {:else if wallpaperImage}
            <img
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
                <span class="text-fg-primary text-[11px]"
                    >Extracting colors...</span
                >
            </div>
        {/if}
    </div>

    <!-- Action buttons — always visible -->
    <div
        class="absolute bottom-0 left-0 right-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3"
    >
        <button
            class="bg-accent hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors duration-100"
            onclick={handleExtractColors}>Extract</button
        >
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
</div>

<ImagePreview
    src={wallpaperImage}
    alt="Wallpaper"
    open={previewOpen}
    onclose={() => (previewOpen = false)}
/>
