<script lang="ts">
    import {getSettings, updateSettings} from '$lib/stores/settings.svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    let choosingFolder = $state(false);
    let wallpaperFolder = $derived(
        getSettings().wallpaperFolder || '~/Wallpapers'
    );

    async function chooseWallpaperFolder() {
        choosingFolder = true;
        try {
            const {ChooseWallpaperFolder} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const folder = await ChooseWallpaperFolder();
            if (!folder) return;

            updateSettings({wallpaperFolder: folder});
            showToast('Wallpaper folder updated');
        } catch (err) {
            console.error('ChooseWallpaperFolder failed', err);
            showToast('Failed to set wallpaper folder');
        } finally {
            choosingFolder = false;
        }
    }
</script>

<div class="mx-auto h-full max-w-3xl overflow-y-auto p-8">
    <header class="mb-8">
        <p
            class="text-accent mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
        >
            Preferences
        </p>
        <h1 class="text-fg-primary text-[24px] font-semibold">Settings</h1>
        <p class="text-fg-dimmed mt-2 max-w-lg text-[12px] leading-relaxed">
            Configure where Aether finds local wallpapers.
        </p>
    </header>

    <section aria-labelledby="wallpaper-library-heading">
        <h2
            id="wallpaper-library-heading"
            class="text-fg-dimmed mb-3 text-[10px] font-medium uppercase tracking-wider"
        >
            Wallpaper library
        </h2>

        <div class="border-border bg-bg-secondary border">
            <div
                class="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]"
            >
                <div
                    class="bg-accent-muted text-accent flex h-9 w-9 shrink-0 items-center justify-center"
                >
                    <svg
                        class="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path
                            d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
                        ></path>
                    </svg>
                </div>

                <div class="min-w-0 flex-1">
                    <div class="text-fg-primary text-[12px] font-medium">
                        Wallpaper folder
                    </div>
                    <p
                        class="text-fg-dimmed mt-1 text-[10px] leading-relaxed"
                    >
                        The Local page scans this folder and all of its
                        subfolders for images.
                    </p>
                    <div
                        class="bg-bg-primary border-border text-fg-secondary mt-3 truncate border px-2.5 py-2 font-mono text-[11px]"
                        title={wallpaperFolder}
                    >
                        {wallpaperFolder}
                    </div>
                </div>

                <button
                    type="button"
                    class="bg-accent text-accent-fg hover:bg-accent-hover col-span-2 w-full shrink-0 px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-wait disabled:opacity-60 sm:col-span-1 sm:w-auto"
                    onclick={chooseWallpaperFolder}
                    disabled={choosingFolder}
                >
                    {choosingFolder ? 'Choosing...' : 'Choose folder...'}
                </button>
            </div>
        </div>
    </section>
</div>
