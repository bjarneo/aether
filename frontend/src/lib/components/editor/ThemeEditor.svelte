<script lang="ts">
    import WallpaperHero from './WallpaperHero.svelte';
    import WallpaperPicker from './WallpaperPicker.svelte';
    import ColorPaletteGrid from './ColorPaletteGrid.svelte';
    import HeroEmptyState from './HeroEmptyState.svelte';
    import ExtendedColors from './ExtendedColors.svelte';
    import AdditionalImages from './AdditionalImages.svelte';
    import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
    import WallpaperEditor from '../wallpaper-editor/WallpaperEditor.svelte';
    import {getWallpaperPath, getPalette} from '$lib/stores/theme.svelte';
    import {getSidebarVisible} from '$lib/stores/ui.svelte';
    import {DEFAULT_PALETTE} from '$lib/types/theme';

    let wallpaper = $derived(getWallpaperPath());
    let palette = $derived(getPalette());
    let hasContent = $derived(
        !!wallpaper || palette.some((c, i) => c !== DEFAULT_PALETTE[i])
    );
    let sidebarVisible = $derived(getSidebarVisible());

    let showWallpaperEditor = $state(false);
</script>

<div class="flex h-full">
    <div class="flex-1 overflow-y-auto p-4">
        {#if hasContent}
            {#if wallpaper}
                <WallpaperHero onedit={() => (showWallpaperEditor = true)} />
            {:else}
                <WallpaperPicker />
            {/if}

            <div class={wallpaper ? 'mt-3' : 'mt-1'}>
                <ColorPaletteGrid />
            </div>
            <ExtendedColors />
            <AdditionalImages />
        {:else}
            <HeroEmptyState />
        {/if}
    </div>

    {#if sidebarVisible}
        <aside class="bg-bg-secondary border-border w-64 shrink-0 border-l">
            <SettingsSidebar />
        </aside>
    {/if}

    <WallpaperEditor
        open={showWallpaperEditor}
        onclose={() => (showWallpaperEditor = false)}
    />
</div>
