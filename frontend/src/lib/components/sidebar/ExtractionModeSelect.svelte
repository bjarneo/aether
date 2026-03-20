<script lang="ts">
    import {
        getExtractionMode,
        setExtractionMode,
        getWallpaperPath,
        getLightMode,
        setIsExtracting,
        setPalette,
        setAdjustments,
    } from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {EXTRACTION_MODES} from '$lib/constants/colors';
    import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';

    async function handleModeChange(mode: string) {
        setExtractionMode(mode);

        // Tell the Go backend about the mode change
        try {
            const {SetExtractionMode} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await SetExtractionMode(mode);
        } catch {}

        // Re-extract colors if a wallpaper is loaded
        const path = getWallpaperPath();
        if (path) {
            setIsExtracting(true);
            try {
                const {ExtractColors} = await import(
                    '../../../../wailsjs/go/main/App'
                );
                const colors = await ExtractColors(path, getLightMode(), mode);
                setAdjustments({...DEFAULT_ADJUSTMENTS});
                setPalette(colors);
                showToast(`Re-extracted with ${mode} mode`);
            } catch {
                showToast('Re-extraction failed');
            } finally {
                setIsExtracting(false);
            }
        }
    }
</script>

<div>
    <h3
        class="text-fg-dimmed mb-2 text-[10px] font-medium uppercase tracking-wider"
    >
        Extraction Mode
    </h3>
    <select
        class="bg-bg-surface border-border text-fg-primary focus:border-border-focus w-full border px-2 py-1.5 text-[11px] outline-none transition-colors duration-100"
        value={getExtractionMode()}
        onchange={e => handleModeChange(e.currentTarget.value)}
    >
        {#each EXTRACTION_MODES as mode}
            <option value={mode.value}>{mode.label}</option>
        {/each}
    </select>
</div>
