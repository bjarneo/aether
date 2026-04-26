import type {main} from '../../../wailsjs/go/models';
import {showToast} from '$lib/stores/ui.svelte';
import {
    getIsApplying,
    setIsApplying,
    getIsExtracting,
    setIsExtracting,
    getWallpaperPath,
    setWallpaperPath,
    getPalette,
    setPalette,
    setPaletteFromExtraction,
    getLightMode,
    getAdditionalImages,
    getExtendedColors,
    getAppOverrides,
    getAdjustments,
    setAdjustments,
    setAdjustedExtendedColors,
    getExtractionMode,
    markApplied,
} from '$lib/stores/theme.svelte';
import {getSettings} from '$lib/stores/settings.svelte';
import {
    undo as historyUndo,
    redo as historyRedo,
    pushRedo,
    pushUndo,
} from '$lib/stores/history.svelte';
import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';

async function runApply(): Promise<{success: boolean}> {
    const {ApplyTheme} = await import('../../../wailsjs/go/main/App');
    const result = await ApplyTheme({
        palette: getPalette(),
        wallpaperPath: getWallpaperPath(),
        lightMode: getLightMode(),
        additionalImages: getAdditionalImages(),
        extendedColors: getExtendedColors(),
        settings: getSettings(),
        appOverrides: getAppOverrides(),
    } as unknown as main.ApplyThemeRequest);
    if (result.success) {
        if (getLightMode()) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
        markApplied();
    }
    return {success: !!result.success};
}

export async function applyTheme(): Promise<void> {
    if (getIsApplying()) return;
    setIsApplying(true);
    try {
        const result = await runApply();
        if (result.success) showToast('Theme applied');
    } catch {
        showToast('Couldn’t apply theme — see logs for details');
    } finally {
        setIsApplying(false);
    }
}

// Quieter undo-offering toast for live preview; long enough to react,
// short enough not to pile up during rapid edits.
const LIVE_APPLY_TOAST_MS = 2200;

// Same backend call as applyTheme(), but with a quieter toast that offers
// Undo. Used by the live-preview effect when the user flips on Live Apply.
export async function applyThemeLive(): Promise<void> {
    if (getIsApplying()) return;
    setIsApplying(true);
    try {
        const result = await runApply();
        if (result.success) {
            showToast('Live preview applied', {
                duration: LIVE_APPLY_TOAST_MS,
                action: {label: 'Undo', run: undoAction},
            });
        }
    } catch {
        // Stay quiet on transient live-apply failures; the user can hit
        // Apply manually if something is wrong.
    } finally {
        setIsApplying(false);
    }
}

export function undoAction(): void {
    const snapshot = historyUndo();
    if (!snapshot) return;
    pushRedo(getPalette(), getExtendedColors(), getAdjustments());
    setPalette(snapshot.palette, true);
    setAdjustedExtendedColors(snapshot.extendedColors);
    setAdjustments(snapshot.adjustments);
}

export function redoAction(): void {
    const snapshot = historyRedo();
    if (!snapshot) return;
    pushUndo(getPalette(), getExtendedColors(), getAdjustments());
    setPalette(snapshot.palette, true);
    setAdjustedExtendedColors(snapshot.extendedColors);
    setAdjustments(snapshot.adjustments);
}

export async function changeWallpaper(): Promise<void> {
    try {
        const {OpenFileDialog} = await import('../../../wailsjs/go/main/App');
        const path = await OpenFileDialog();
        if (path) {
            setWallpaperPath(path);
            showToast('Wallpaper changed — click Extract to generate palette');
        }
    } catch {
        showToast('Couldn’t open the wallpaper picker');
    }
}

export async function extractColors(): Promise<void> {
    const path = getWallpaperPath();
    if (!path || getIsExtracting()) return;
    setIsExtracting(true);
    try {
        const {ExtractColors} = await import('../../../wailsjs/go/main/App');
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
