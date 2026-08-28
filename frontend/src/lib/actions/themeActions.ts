import type {main} from '../../../wailsjs/go/models';
import {
    showToast,
    setLivePending,
    setApplySaveDialogOpen,
} from '$lib/stores/ui.svelte';
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
    getIconTheme,
    setIconTheme,
} from '$lib/stores/theme.svelte';
import {getSettings} from '$lib/stores/settings.svelte';
import type {Settings} from '$lib/types/theme';
import {
    undo as historyUndo,
    redo as historyRedo,
    pushRedo,
    pushUndo,
} from '$lib/stores/history.svelte';
import {DEFAULT_ADJUSTMENTS} from '$lib/types/theme';
import {STORAGE_KEYS} from '$lib/constants/storage';

function countTargetedApps(
    settings: Settings,
    appOverrides: Record<string, Record<string, string>>
): number {
    const targeted = new Set(
        Object.entries(settings.includedApps ?? {})
            .filter(([, included]) => included)
            .map(([app]) => app)
    );
    for (const [app, overrides] of Object.entries(appOverrides)) {
        if (Object.keys(overrides).length > 0) targeted.add(app);
    }
    return targeted.size;
}

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
        iconTheme: getIconTheme(),
    } as unknown as main.ApplyThemeRequest);
    if (result.success) {
        if (getLightMode()) {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
    }
    return {success: !!result.success};
}

export async function applyTheme(): Promise<void> {
    if (getIsApplying()) return;
    setIsApplying(true);
    try {
        const result = await runApply();
        const count = countTargetedApps(getSettings(), getAppOverrides());
        markApplied();
        const suffix = count
            ? ` with ${count} app override${count === 1 ? '' : 's'}`
            : '';
        if (result.success) {
            showToast(`Theme applied${suffix}`);
        } else {
            showToast(`Theme files generated${suffix}`);
        }
    } catch {
        showToast('Couldn’t apply theme — see logs for details');
    } finally {
        setIsApplying(false);
    }
}

function getSavedThemeFolder(): string {
    const wallpaper = getWallpaperPath();
    if (!wallpaper) return '';
    try {
        const folders = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.savedThemeFolders) ?? '{}'
        ) as Record<string, string>;
        return folders[wallpaper] ?? '';
    } catch {
        return '';
    }
}

function saveThemeFolder(name: string): void {
    const wallpaper = getWallpaperPath();
    if (!wallpaper) return;
    try {
        const folders = JSON.parse(
            localStorage.getItem(STORAGE_KEYS.savedThemeFolders) ?? '{}'
        ) as Record<string, string>;
        localStorage.setItem(
            STORAGE_KEYS.savedThemeFolders,
            JSON.stringify({...folders, [wallpaper]: name})
        );
    } catch {}
}

// The primary Apply action updates the folder saved for this wallpaper.
// Ctrl+Enter remains an intentional bypass for quickly applying editor state.
export function requestThemeApply(): void {
    if (getIsApplying()) return;
    const savedFolder = getSavedThemeFolder();
    if (savedFolder) {
        saveAndApplyTheme(savedFolder, true);
    } else {
        saveThemeAsNew();
    }
}

export function saveThemeAsNew(): void {
    if (!getIsApplying()) setApplySaveDialogOpen(true);
}

export async function saveAndApplyTheme(
    name: string,
    updateExisting = false
): Promise<void> {
    if (getIsApplying()) return;
    setIsApplying(true);
    try {
        const {SaveAndApplyTheme} = await import(
            '../../../wailsjs/go/main/App'
        );
        const result = await SaveAndApplyTheme({
            name,
            updateExisting,
            palette: getPalette(),
            wallpaperPath: getWallpaperPath(),
            lightMode: getLightMode(),
            additionalImages: getAdditionalImages(),
            extendedColors: getExtendedColors(),
            settings: getSettings(),
            appOverrides: getAppOverrides(),
            iconTheme: getIconTheme(),
        } as unknown as main.SaveAndApplyThemeRequest);
        saveThemeFolder(name);
        if (result.success) {
            if (getLightMode()) {
                document.documentElement.classList.add('light-mode');
            } else {
                document.documentElement.classList.remove('light-mode');
            }
        }
        markApplied();
        showToast(
            updateExisting ? `Applied: ${name}` : `Saved and applied: ${name}`
        );
    } catch (e: unknown) {
        showToast(
            e instanceof Error ? e.message : 'Couldn’t save and apply theme'
        );
    } finally {
        setIsApplying(false);
    }
}

// Swap the wallpaper without re-extracting colors. Resolves remote URLs
// (Wallhaven) by downloading first, then runs the standard apply path so
// the new wallpaper goes out together with the current palette.
export async function applyWallpaperOnly(originalPath: string): Promise<void> {
    if (getIsApplying() || !originalPath) return;

    let path = originalPath;
    if (path.startsWith('http://') || path.startsWith('https://')) {
        try {
            showToast('Downloading wallpaper…');
            const {DownloadWallpaper} = await import(
                '../../../wailsjs/go/main/App'
            );
            path = await DownloadWallpaper(path);
        } catch {
            showToast('Failed to download wallpaper');
            return;
        }
    }
    setWallpaperPath(path);

    setIsApplying(true);
    try {
        const result = await runApply();
        markApplied();
        showToast(
            result.success ? 'Wallpaper applied' : 'Wallpaper files generated'
        );
    } catch {
        showToast('Couldn’t apply wallpaper — see logs for details');
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
    if (getIsApplying()) {
        setLivePending(false);
        return;
    }
    setIsApplying(true);
    try {
        const result = await runApply();
        if (result.success) {
            markApplied();
            const count = countTargetedApps(getSettings(), getAppOverrides());
            const suffix = count
                ? ` with ${count} app override${count === 1 ? '' : 's'}`
                : '';
            showToast(`Live preview applied${suffix}`, {
                duration: LIVE_APPLY_TOAST_MS,
                action: {label: 'Undo', run: undoAction},
            });
        }
    } catch {
        // Stay quiet on transient live-apply failures; the user can hit
        // Apply manually if something is wrong.
    } finally {
        setIsApplying(false);
        setLivePending(false);
    }
}

export function undoAction(): void {
    const snapshot = historyUndo();
    if (!snapshot) return;
    pushRedo(
        getPalette(),
        getExtendedColors(),
        getAdjustments(),
        getIconTheme()
    );
    setPalette(snapshot.palette, true);
    setAdjustedExtendedColors(snapshot.extendedColors);
    setAdjustments(snapshot.adjustments);
    setIconTheme(snapshot.iconTheme, true);
}

export function redoAction(): void {
    const snapshot = historyRedo();
    if (!snapshot) return;
    pushUndo(
        getPalette(),
        getExtendedColors(),
        getAdjustments(),
        getIconTheme()
    );
    setPalette(snapshot.palette, true);
    setAdjustedExtendedColors(snapshot.extendedColors);
    setAdjustments(snapshot.adjustments);
    setIconTheme(snapshot.iconTheme, true);
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
