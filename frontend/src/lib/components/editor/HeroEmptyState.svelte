<script lang="ts">
    import {showToast, setActiveTab} from '$lib/stores/ui.svelte';
    import {setWallpaperPath} from '$lib/stores/theme.svelte';

    let isBrowsing = $state(false);

    async function handleBrowse() {
        if (isBrowsing) return;
        isBrowsing = true;
        try {
            const {OpenFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const path = await OpenFileDialog();
            if (path) {
                setWallpaperPath(path);
                showToast(
                    'Wallpaper selected — click Extract to generate palette'
                );
            }
        } catch (e: any) {
            showToast('Failed to open file');
        } finally {
            isBrowsing = false;
        }
    }
</script>

<div class="flex h-full min-h-[400px] flex-col items-center justify-center">
    <div class="text-center">
        <div
            class="border-border mx-auto mb-4 flex h-16 w-16 items-center justify-center border"
        >
            <svg
                class="text-fg-dimmed h-7 w-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="square"
                    stroke-width="1.5"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
            </svg>
        </div>
        <h2 class="text-fg-primary mb-1 text-sm font-medium">
            Select a Wallpaper
        </h2>
        <p class="text-fg-dimmed mb-6 max-w-[240px] text-[11px]">
            Drop an image, browse local files, or search Wallhaven to begin
        </p>
        <div class="flex justify-center gap-2">
            <button
                class="bg-accent text-bg-primary hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium transition-colors duration-100 disabled:opacity-50"
                onclick={handleBrowse}
                disabled={isBrowsing}
            >
                {isBrowsing ? 'Opening...' : 'Browse Files'}
            </button>
            <button
                class="text-fg-secondary border-border hover:text-fg-primary hover:bg-bg-hover border px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                onclick={() => setActiveTab('wallhaven')}
            >
                Search Wallhaven
            </button>
        </div>
    </div>
</div>
