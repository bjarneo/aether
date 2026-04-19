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
    getLightMode,
    getAdditionalImages,
    getExtendedColors,
    getAppOverrides,
    getAdjustments,
    setAdjustments,
    setAdjustedExtendedColors,
    getExtractionMode,
} from '$lib/stores/theme.svelte';
import {getSettings} from '$lib/stores/settings.svelte';
import {
    undo as historyUndo,
    redo as historyRedo,
    pushRedo,
    pushUndo,
} from '$lib/stores/history.svelte';
import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';

export async function applyTheme(): Promise<void> {
    if (getIsApplying()) return;
    setIsApplying(true);
    try {
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
        if (result.success) showToast('Theme applied');
    } catch {
        showToast('Failed to apply theme');
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
        showToast('Failed to change wallpaper');
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
        setPalette(colors);
        showToast('Colors extracted');
    } catch {
        showToast('Failed to extract colors');
    } finally {
        setIsExtracting(false);
    }
}
