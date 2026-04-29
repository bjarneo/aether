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
            showToast('Couldn’t open that file. Is it an image or video?');
        } finally {
            isBrowsing = false;
        }
    }
</script>

<div
    class="flex h-full min-h-[400px] flex-col items-center justify-center px-6"
>
    <div class="w-full max-w-md text-center">
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
            Pick a wallpaper to begin
        </h2>
        <p class="text-fg-dimmed mb-6 text-[11px]">
            Browse local files or search Wallhaven to begin
        </p>
        <div class="mb-8 flex justify-center gap-2">
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
            <button
                class="text-fg-secondary border-border hover:text-fg-primary hover:bg-bg-hover border px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
                onclick={() => setActiveTab('local')}
            >
                Browse Local
            </button>
        </div>

        <div class="border-border border-t pt-6 text-left">
            <h3
                class="text-fg-secondary mb-3 text-[10px] font-medium uppercase tracking-wide"
            >
                How it works
            </h3>
            <ol class="space-y-3 text-[11px]">
                <li class="flex gap-3">
                    <span
                        class="border-border text-fg-dimmed flex h-5 w-5 shrink-0 items-center justify-center border text-[10px]"
                    >
                        1
                    </span>
                    <span class="text-fg-secondary">
                        <span class="text-fg-primary font-medium"
                            >Pick a wallpaper.</span
                        >
                        Browse your local files or search Wallhaven for an image.
                    </span>
                </li>
                <li class="flex gap-3">
                    <span
                        class="border-border text-fg-dimmed flex h-5 w-5 shrink-0 items-center justify-center border text-[10px]"
                    >
                        2
                    </span>
                    <span class="text-fg-secondary">
                        <span class="text-fg-primary font-medium"
                            >Extract the palette.</span
                        >
                        Click <span class="text-fg-primary">Extract</span> in the
                        action bar to generate 16 cohesive colors from the image.
                        Tweak the extraction mode in the sidebar if you want a different
                        vibe.
                    </span>
                </li>
                <li class="flex gap-3">
                    <span
                        class="border-border text-fg-dimmed flex h-5 w-5 shrink-0 items-center justify-center border text-[10px]"
                    >
                        3
                    </span>
                    <span class="text-fg-secondary">
                        <span class="text-fg-primary font-medium"
                            >Apply the theme.</span
                        >
                        Click <span class="text-fg-primary">Apply</span>
                        (or press
                        <kbd
                            class="border-border bg-bg-surface text-fg-primary border px-1 text-[10px]"
                            >Ctrl+Enter</kbd
                        >) to push colors and the wallpaper out to your apps.
                    </span>
                </li>
            </ol>
            <p class="text-fg-dimmed mt-4 text-[10px]">
                Save snapshots in the
                <button
                    class="text-fg-secondary hover:text-fg-primary underline"
                    onclick={() => setActiveTab('blueprints')}
                    >Blueprints</button
                >
                tab. Press
                <kbd
                    class="border-border bg-bg-surface text-fg-primary border px-1 text-[10px]"
                    >?</kbd
                >
                anytime for keyboard shortcuts.
            </p>
        </div>
    </div>
</div>
