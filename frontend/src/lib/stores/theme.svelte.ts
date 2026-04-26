import {
    DEFAULT_PALETTE,
    DEFAULT_ADJUSTMENTS,
    type Adjustments,
    type ColorRoles,
} from '$lib/types/theme';
import {pushState} from '$lib/stores/history.svelte';

// --- Reactive state ---
let palette = $state<string[]>([...DEFAULT_PALETTE]);
let basePalette = $state<string[]>([...DEFAULT_PALETTE]);
let wallpaperPath = $state<string>('');
let lightMode = $state<boolean>(false);
let lockedColors = $state<Record<number, boolean>>({});
let selectedColors = $state<Record<number, boolean>>({}); // empty = all selected
let selectedExtColors = $state<Record<string, boolean>>({}); // extended color selection
let adjustments = $state<Adjustments>({...DEFAULT_ADJUSTMENTS});
let extractionMode = $state<string>('normal');
let isExtracting = $state<boolean>(false);
let isApplying = $state<boolean>(false);
let additionalImages = $state<string[]>([]);
let appOverrides = $state<Record<string, Record<string, string>>>({});
let paletteCurvePoints = $state<[number, number][]>([]);
// Source path of the most recently extracted palette. Used to decide
// whether per-app template overrides should be cleared on the next
// extraction (a fresh image invalidates color choices made for the
// previous palette).
let lastExtractedPath = $state<string>('');

// Extended colors — independent from palette, initialized from palette on extract/load
let extendedColors = $state<Record<string, string>>({
    accent: DEFAULT_PALETTE[4],
    cursor: DEFAULT_PALETTE[7],
    selection_foreground: DEFAULT_PALETTE[0],
    selection_background: DEFAULT_PALETTE[7],
});
let baseExtendedColors = $state<Record<string, string>>({
    accent: DEFAULT_PALETTE[4],
    cursor: DEFAULT_PALETTE[7],
    selection_foreground: DEFAULT_PALETTE[0],
    selection_background: DEFAULT_PALETTE[7],
});

// --- Derived ---
let colorRoles = $derived<ColorRoles>(buildColorRoles(palette, extendedColors));

function buildColorRoles(p: string[], ext: Record<string, string>): ColorRoles {
    return {
        background: p[0],
        foreground: p[7],
        black: p[0],
        red: p[1],
        green: p[2],
        yellow: p[3],
        blue: p[4],
        magenta: p[5],
        cyan: p[6],
        white: p[7],
        bright_black: p[8],
        bright_red: p[9],
        bright_green: p[10],
        bright_yellow: p[11],
        bright_blue: p[12],
        bright_magenta: p[13],
        bright_cyan: p[14],
        bright_white: p[15],
        accent: ext.accent,
        cursor: ext.cursor,
        selection_foreground: ext.selection_foreground,
        selection_background: ext.selection_background,
    };
}

// --- Getters ---
export function getPalette(): string[] {
    return palette;
}
export function getBasePalette(): string[] {
    return basePalette;
}
export function getWallpaperPath(): string {
    return wallpaperPath;
}
export function getLightMode(): boolean {
    return lightMode;
}
export function getLockedColors(): Record<number, boolean> {
    return lockedColors;
}
export function getSelectedColors(): Record<number, boolean> {
    return selectedColors;
}
export function hasColorSelection(): boolean {
    return Object.values(selectedColors).some(v => v);
}
export function toggleColorSelection(index: number): void {
    selectedColors = {...selectedColors, [index]: !selectedColors[index]};
}
export function clearColorSelection(): void {
    selectedColors = {};
    selectedExtColors = {};
}
export function getSelectedExtColors(): Record<string, boolean> {
    return selectedExtColors;
}
export function hasExtColorSelection(): boolean {
    return Object.values(selectedExtColors).some(v => v);
}
export function toggleExtColorSelection(key: string): void {
    selectedExtColors = {...selectedExtColors, [key]: !selectedExtColors[key]};
}
export function hasAnySelection(): boolean {
    return hasColorSelection() || hasExtColorSelection();
}
export function getAdjustments(): Adjustments {
    return adjustments;
}
export function getExtractionMode(): string {
    return extractionMode;
}
export function getIsExtracting(): boolean {
    return isExtracting;
}
export function getIsApplying(): boolean {
    return isApplying;
}
export function getAdditionalImages(): string[] {
    return additionalImages;
}
export function getExtendedColors(): Record<string, string> {
    return extendedColors;
}
export function getBaseExtendedColors(): Record<string, string> {
    return baseExtendedColors;
}
export function getAppOverrides(): Record<string, Record<string, string>> {
    return appOverrides;
}

// Snapshot of the fields mirrored into Go for IPC reads (aether status) and
// for constructing ApplyThemeRequest/SaveBlueprintRequest payloads.
export function getThemeSnapshot(): {
    palette: string[];
    wallpaperPath: string;
    lightMode: boolean;
    extendedColors: Record<string, string>;
    appOverrides: Record<string, Record<string, string>>;
    additionalImages: string[];
} {
    return {
        palette,
        wallpaperPath,
        lightMode,
        extendedColors,
        appOverrides,
        additionalImages,
    };
}

// Snapshot signature is used as a cheap dirty-state and live-apply trigger.
// Field order here is fixed so JSON.stringify is stable across calls.
export function getThemeSignature(): string {
    return JSON.stringify([
        palette,
        wallpaperPath,
        lightMode,
        extendedColors,
        appOverrides,
        additionalImages,
    ]);
}

let lastAppliedSignature = $state<string>('');
export function markApplied(): void {
    lastAppliedSignature = getThemeSignature();
}
export function isDirty(): boolean {
    // Empty signature means nothing has been applied yet in this session,
    // so suppress the dirty indicator until the first apply.
    if (!lastAppliedSignature) return false;
    return getThemeSignature() !== lastAppliedSignature;
}
export function getPaletteCurvePoints(): [number, number][] {
    return paletteCurvePoints;
}
export function setPaletteCurvePoints(pts: [number, number][]): void {
    paletteCurvePoints = pts;
}
export function setAppOverride(app: string, role: string, hex: string): void {
    const current = appOverrides[app] || {};
    appOverrides = {...appOverrides, [app]: {...current, [role]: hex}};
}
export function removeAppOverride(app: string, role: string): void {
    if (!appOverrides[app]) return;
    const {[role]: _, ...rest} = appOverrides[app];
    if (Object.keys(rest).length === 0) {
        const {[app]: __, ...remaining} = appOverrides;
        appOverrides = remaining;
    } else {
        appOverrides = {...appOverrides, [app]: rest};
    }
}
export function clearAppOverridesForApp(app: string): void {
    const {[app]: _, ...remaining} = appOverrides;
    appOverrides = remaining;
}
export function setAppOverrides(
    overrides: Record<string, Record<string, string>>
): void {
    appOverrides = overrides ? {...overrides} : {};
}

// --- Setters ---

// setPalette sets both the display palette AND the base palette.
// Also initializes extended colors from the new palette.
// Pass skipHistory=true when restoring from undo/redo to avoid double-push.
let hasEverChanged = false;

export function setPalette(colors: string[], skipHistory = false): void {
    if (!skipHistory && hasEverChanged) {
        pushState(palette, extendedColors, adjustments);
    }
    hasEverChanged = true;
    basePalette = [...colors];
    palette = [...colors];
    if (!skipHistory) {
        // Only derive extended colors when not restoring from history
        const ext = {
            accent: colors[4] || extendedColors.accent,
            cursor: colors[7] || extendedColors.cursor,
            selection_foreground:
                colors[0] || extendedColors.selection_foreground,
            selection_background:
                colors[7] || extendedColors.selection_background,
        };
        baseExtendedColors = {...ext};
        extendedColors = {...ext};
    }
}

// setAdjustedPalette sets only the display palette (from adjustment results).
export function setAdjustedPalette(colors: string[]): void {
    palette = [...colors];
}

// setPaletteFromExtraction is the entry point used by extract flows. It
// drops per-app template overrides when the source image changes, since
// override hex values were chosen relative to the prior palette and tend
// to look out of place on a different wallpaper.
export function setPaletteFromExtraction(path: string, colors: string[]): void {
    if (path && lastExtractedPath && path !== lastExtractedPath) {
        appOverrides = {};
    }
    lastExtractedPath = path;
    setPalette(colors);
}

export function setLastExtractedPath(path: string): void {
    lastExtractedPath = path;
}

// setAdjustedExtendedColors sets only the display extended colors (from adjustment results).
export function setAdjustedExtendedColors(
    colors: Record<string, string>
): void {
    extendedColors = {...colors};
}

// Debounced history push for individual color edits (picker drag)
let colorEditTimer: ReturnType<typeof setTimeout> | null = null;
let colorEditSnapshotPushed = false;

export function setColor(index: number, hex: string): void {
    // Push history once at the start of a color edit session, not on every drag tick
    if (!colorEditSnapshotPushed) {
        pushState(palette, extendedColors, adjustments);
        colorEditSnapshotPushed = true;
    }
    if (colorEditTimer) clearTimeout(colorEditTimer);
    colorEditTimer = setTimeout(() => {
        colorEditSnapshotPushed = false;
    }, 1000);

    palette[index] = hex;
    basePalette[index] = hex;
    palette = [...palette];
    basePalette = [...basePalette];
}

let extEditSnapshotPushed = false;
let extEditTimer: ReturnType<typeof setTimeout> | null = null;

export function setExtendedColor(key: string, hex: string): void {
    if (!extEditSnapshotPushed) {
        pushState(palette, extendedColors, adjustments);
        extEditSnapshotPushed = true;
    }
    if (extEditTimer) clearTimeout(extEditTimer);
    extEditTimer = setTimeout(() => {
        extEditSnapshotPushed = false;
    }, 1000);

    extendedColors = {...extendedColors, [key]: hex};
    baseExtendedColors = {...baseExtendedColors, [key]: hex};
}

export function setWallpaperPath(path: string): void {
    wallpaperPath = path;
}
export function setLightMode(enabled: boolean): void {
    lightMode = enabled;
}
export function setLockedColor(index: number, locked: boolean): void {
    lockedColors = {...lockedColors, [index]: locked};
}
export function setAdjustments(adj: Adjustments): void {
    adjustments = {...adj};
}
export function setExtractionMode(mode: string): void {
    extractionMode = mode;
}
export function setIsExtracting(v: boolean): void {
    isExtracting = v;
}
export function setIsApplying(v: boolean): void {
    isApplying = v;
}

export function setAdditionalImages(images: string[]): void {
    additionalImages = [...images];
}

export function addAdditionalImage(path: string): void {
    if (!additionalImages.includes(path)) {
        additionalImages = [...additionalImages, path];
    }
}

export function removeAdditionalImage(path: string): void {
    additionalImages = additionalImages.filter(p => p !== path);
}

export function swapMainWithAdditional(path: string): void {
    const idx = additionalImages.indexOf(path);
    if (idx === -1) return;
    const oldMain = wallpaperPath;
    wallpaperPath = path;
    const next = [...additionalImages];
    if (oldMain) {
        next[idx] = oldMain;
    } else {
        next.splice(idx, 1);
    }
    additionalImages = next;
}

// --- Shuffle (experimental) ---
// Randomly reassigns ANSI color roles 1-6 (and their bright counterparts 9-14).
// Locked colors are excluded from the shuffle.
export function shufflePalette(): void {
    pushState(palette, extendedColors, adjustments);

    const indices = [1, 2, 3, 4, 5, 6];
    const unlocked = indices.filter(i => !lockedColors[i]);
    if (unlocked.length < 2) return; // nothing to shuffle

    // Fisher-Yates shuffle on unlocked indices
    const colors = unlocked.map(i => palette[i]);
    const brights = unlocked.map(i => palette[i + 8]);
    for (let i = colors.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colors[i], colors[j]] = [colors[j], colors[i]];
        [brights[i], brights[j]] = [brights[j], brights[i]];
    }

    const newPalette = [...palette];
    unlocked.forEach((idx, i) => {
        newPalette[idx] = colors[i];
        newPalette[idx + 8] = brights[i];
    });
    basePalette = [...newPalette];
    palette = [...newPalette];
}

// --- Reset ---
export function reset(): void {
    palette = [...DEFAULT_PALETTE];
    basePalette = [...DEFAULT_PALETTE];
    wallpaperPath = '';
    lightMode = false;
    lockedColors = {};
    adjustments = {...DEFAULT_ADJUSTMENTS};
    extractionMode = 'normal';
    additionalImages = [];
    const ext = {
        accent: DEFAULT_PALETTE[4],
        cursor: DEFAULT_PALETTE[7],
        selection_foreground: DEFAULT_PALETTE[0],
        selection_background: DEFAULT_PALETTE[7],
    };
    extendedColors = {...ext};
    baseExtendedColors = {...ext};
    appOverrides = {};
    paletteCurvePoints = [];
}
