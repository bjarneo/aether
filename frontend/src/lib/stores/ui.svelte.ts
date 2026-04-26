export type Tab =
    | 'editor'
    | 'wallhaven'
    | 'local'
    | 'favorites'
    | 'blueprints'
    | 'system';

export const COLOR_MODELS = ['rgb', 'hsl', 'oklch'] as const;
export type ColorModel = (typeof COLOR_MODELS)[number];

// --- Reactive state ---
let activeTab = $state<Tab>('editor');
let sidebarVisible = $state<boolean>(true);
let toastMessage = $state<string>('');
let toastVisible = $state<boolean>(false);
let toastAction = $state<{label: string; run: () => void} | null>(null);
let liveApply = $state<boolean>(readLiveApply());

function readLiveApply(): boolean {
    try {
        return localStorage.getItem('aether-live-apply') === '1';
    } catch {
        return false;
    }
}
let colorPickerOpen = $state<boolean>(false);
let colorPickerIndex = $state<number>(-1);
let colorPickerExtKey = $state<string>(''); // non-empty = editing an extended color
let colorPickerOverrideApp = $state<string>(''); // non-empty = editing an app override
let colorPickerOverrideRole = $state<string>(''); // the color role being overridden
let eyedropperActive = $state<boolean>(false);
let colorPickerModel = $state<ColorModel>('rgb');
let commandPaletteOpen = $state<boolean>(false);
let keymapOpen = $state<boolean>(false);
let imageEditorOpen = $state<boolean>(false);

// --- Getters ---
export function getActiveTab(): Tab {
    return activeTab;
}
export function getSidebarVisible(): boolean {
    return sidebarVisible;
}
export function getToastMessage(): string {
    return toastMessage;
}
export function getToastVisible(): boolean {
    return toastVisible;
}
export function getColorPickerOpen(): boolean {
    return colorPickerOpen;
}
export function getColorPickerIndex(): number {
    return colorPickerIndex;
}
export function getColorPickerExtKey(): string {
    return colorPickerExtKey;
}
export function getColorPickerOverrideApp(): string {
    return colorPickerOverrideApp;
}
export function getColorPickerOverrideRole(): string {
    return colorPickerOverrideRole;
}
export function getEyedropperActive(): boolean {
    return eyedropperActive;
}
export function getColorPickerModel(): ColorModel {
    return colorPickerModel;
}
export function setColorPickerModel(m: ColorModel): void {
    colorPickerModel = m;
}

// --- Actions ---
export function setActiveTab(tab: Tab): void {
    activeTab = tab;
}

export function toggleSidebar(): void {
    sidebarVisible = !sidebarVisible;
}

export function showToast(
    msg: string,
    durationOrOpts:
        | number
        | {duration?: number; action?: {label: string; run: () => void}} = 3000
): void {
    const opts =
        typeof durationOrOpts === 'number'
            ? {duration: durationOrOpts}
            : durationOrOpts;
    const duration = opts.duration ?? 3000;
    toastMessage = msg;
    toastAction = opts.action ?? null;
    toastVisible = true;
    setTimeout(() => {
        toastVisible = false;
        toastAction = null;
    }, duration);
}

export function getToastAction(): {label: string; run: () => void} | null {
    return toastAction;
}

export function getLiveApply(): boolean {
    return liveApply;
}
export function setLiveApply(v: boolean): void {
    liveApply = v;
    try {
        localStorage.setItem('aether-live-apply', v ? '1' : '0');
    } catch {}
}

export function openColorPicker(index: number): void {
    colorPickerIndex = index;
    colorPickerExtKey = '';
    colorPickerOverrideApp = '';
    colorPickerOverrideRole = '';
    colorPickerOpen = true;
}

export function openExtendedColorPicker(key: string): void {
    colorPickerIndex = -1;
    colorPickerExtKey = key;
    colorPickerOverrideApp = '';
    colorPickerOverrideRole = '';
    colorPickerOpen = true;
}

export function openOverrideColorPicker(app: string, role: string): void {
    colorPickerIndex = -1;
    colorPickerExtKey = '';
    colorPickerOverrideApp = app;
    colorPickerOverrideRole = role;
    colorPickerOpen = true;
}

export function closeColorPicker(): void {
    colorPickerOpen = false;
    colorPickerIndex = -1;
    colorPickerExtKey = '';
    colorPickerOverrideApp = '';
    colorPickerOverrideRole = '';
    eyedropperActive = false;
}

export function setEyedropperActive(v: boolean): void {
    eyedropperActive = v;
}

export function getCommandPaletteOpen(): boolean {
    return commandPaletteOpen;
}
export function openCommandPalette(): void {
    commandPaletteOpen = true;
}
export function closeCommandPalette(): void {
    commandPaletteOpen = false;
}

export function getKeymapOpen(): boolean {
    return keymapOpen;
}
export function setKeymapOpen(v: boolean): void {
    keymapOpen = v;
}
export function toggleKeymap(): void {
    keymapOpen = !keymapOpen;
}

export function getImageEditorOpen(): boolean {
    return imageEditorOpen;
}
export function setImageEditorOpen(v: boolean): void {
    imageEditorOpen = v;
}
