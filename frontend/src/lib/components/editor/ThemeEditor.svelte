<script lang="ts">
    import WallpaperHero from './WallpaperHero.svelte';
    import WallpaperPicker from './WallpaperPicker.svelte';
    import ColorPaletteGrid from './ColorPaletteGrid.svelte';
    import HeroEmptyState from './HeroEmptyState.svelte';
    import ExtendedColors from './ExtendedColors.svelte';
    import AppColorOverrides from './AppColorOverrides.svelte';
    import AdditionalImages from './AdditionalImages.svelte';
    import SettingsSidebar from '../sidebar/SettingsSidebar.svelte';
    import ColorPickerDialog from '../color-picker/ColorPickerDialog.svelte';
    import WallpaperEditor from '../wallpaper-editor/WallpaperEditor.svelte';
    import {getWallpaperPath, getPalette} from '$lib/stores/theme.svelte';
    import {
        getSidebarVisible,
        getColorPickerOpen,
        getImageEditorOpen,
        setImageEditorOpen,
    } from '$lib/stores/ui.svelte';
    import {DEFAULT_PALETTE} from '$lib/types/theme';

    let wallpaper = $derived(getWallpaperPath());
    let palette = $derived(getPalette());
    let hasContent = $derived(
        !!wallpaper || palette.some((c, i) => c !== DEFAULT_PALETTE[i])
    );
    let sidebarVisible = $derived(getSidebarVisible());
    let colorPickerOpen = $derived(getColorPickerOpen());
</script>

<div class="flex h-full">
    {#if sidebarVisible}
        <aside class="bg-bg-secondary border-border w-64 shrink-0 border-r">
            <SettingsSidebar />
        </aside>
    {/if}

    <div class="flex-1 overflow-y-auto p-4">
        {#if hasContent}
            {#if wallpaper}
                <WallpaperHero
                    expanded={colorPickerOpen}
                    onedit={() => setImageEditorOpen(true)}
                />
            {:else}
                <WallpaperPicker />
            {/if}

            <div class={wallpaper ? 'mt-3' : 'mt-1'}>
                <ColorPaletteGrid />
            </div>
            <ExtendedColors />
            <div class="mt-4 flex flex-col gap-4 sm:flex-row">
                <div class="min-w-0 flex-1">
                    <AppColorOverrides />
                </div>
                <div class="min-w-0 flex-1">
                    <AdditionalImages />
                </div>
            </div>
        {:else}
            <HeroEmptyState />
        {/if}
    </div>

    {#if colorPickerOpen}
        <aside
            class="bg-bg-secondary border-border w-72 shrink-0 overflow-y-auto border-l"
        >
            <ColorPickerDialog />
        </aside>
    {/if}

    <WallpaperEditor
        open={getImageEditorOpen()}
        onclose={() => setImageEditorOpen(false)}
    />
</div>
