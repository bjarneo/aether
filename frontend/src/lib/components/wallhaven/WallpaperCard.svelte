<script lang="ts">
    import {setWallpaperPath} from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';

    let {wallpaper, onpreview}: {wallpaper: any; onpreview: () => void} =
        $props();
    let isDownloading = $state(false);
    let isFavorited = $state(false);

    // Check initial favorite status
    $effect(() => {
        checkFavorite();
    });

    async function checkFavorite() {
        try {
            const {IsFavorite} = await import(
                '../../../../wailsjs/go/main/App'
            );
            isFavorited = await IsFavorite(wallpaper.path || wallpaper.id);
        } catch {}
    }

    async function handleUse() {
        isDownloading = true;
        try {
            const {DownloadWallpaper} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const localPath = await DownloadWallpaper(wallpaper.path);
            setWallpaperPath(localPath);
            setActiveTab('editor');
            showToast('Wallpaper selected — click Extract to generate palette');
        } catch (e: any) {
            showToast('Failed to download wallpaper');
        } finally {
            isDownloading = false;
        }
    }

    async function handleFavorite(event: MouseEvent) {
        event.stopPropagation();
        try {
            const {ToggleFavorite} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ToggleFavorite(
                wallpaper.path || wallpaper.id,
                'wallhaven',
                {
                    id: wallpaper.id,
                    thumbUrl: wallpaper.thumbs?.small,
                    resolution: wallpaper.resolution,
                }
            );
            isFavorited = result;
        } catch {}
    }

    async function handleVisit() {
        try {
            const {BrowserOpenURL} = await import(
                '../../../../wailsjs/runtime/runtime'
            );
            BrowserOpenURL(`https://wallhaven.cc/w/${wallpaper.id}`);
        } catch {}
    }

    function formatSize(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }
</script>

<div class="bg-bg-surface border-border group relative overflow-hidden border">
    <div class="aspect-video overflow-hidden bg-[#0a0a0e]">
        <img
            src={wallpaper.thumbs?.large ||
                wallpaper.thumbs?.original ||
                wallpaper.thumbs?.small}
            alt={wallpaper.id}
            class="h-full w-full object-cover"
            loading="lazy"
        />
    </div>

    <!-- Favorite heart — always visible in corner -->
    <button
        class="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center transition-all duration-150
      {isFavorited
            ? 'opacity-100'
            : 'opacity-0 hover:!opacity-100 group-hover:opacity-60'}"
        onclick={handleFavorite}
        aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
    >
        <svg
            class="h-4 w-4 {isFavorited ? 'text-destructive' : 'text-white'}"
            viewBox="0 0 24 24"
            fill={isFavorited ? 'currentColor' : 'none'}
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

    <!-- Info bar -->
    <div
        class="text-fg-dimmed flex items-center justify-between px-2 py-1.5 text-[10px]"
    >
        <span>{wallpaper.resolution}</span>
        <span>{formatSize(wallpaper.file_size)}</span>
    </div>

    <!-- Hover overlay -->
    <div
        class="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    >
        <button
            class="bg-accent hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium text-[#111116] transition-colors disabled:opacity-50"
            onclick={handleUse}
            disabled={isDownloading}
        >
            {isDownloading ? 'Loading...' : 'Use'}
        </button>
        <button
            class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors"
            onclick={onpreview}>Preview</button
        >
        <button
            class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors"
            onclick={handleVisit}>Visit</button
        >
    </div>
</div>
