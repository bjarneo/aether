import {STORAGE_KEYS} from '$lib/constants/storage';

export type Tab =
    | 'editor'
    | 'wallhaven'
    | 'local'
    | 'favorites'
    | 'blueprints'
    | 'system';

export const COLOR_MODELS = ['rgb', 'hsl', 'oklch'] as const;
export type ColorModel = (typeof COLOR_MODELS)[number];

export type ToastAction = {label: string; run: () => void};

// --- Reactive state ---
let activeTab = $state<Tab>('editor');
let sidebarVisible = $state<boolean>(true);
let toastMessage = $state<string>('');
let toastVisible = $state<boolean>(false);
let toastAction = $state<ToastAction | null>(null);
let liveApply = $state<boolean>(readBoolPref(STORAGE_KEYS.liveApply, false));
let targetsVisible = $state<boolean>(
    readBoolPref(STORAGE_KEYS.targetsVisible, true)
);

function readBoolPref(key: string, fallback: boolean): boolean {
    try {
        const v = localStorage.getItem(key);
        if (v === '1') return true;
        if (v === '0') return false;
        return fallback;
    } catch {
        return fallback;
    }
}

function writeBoolPref(key: string, value: boolean): void {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch {}
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
    durationOrOpts: number | {duration?: number; action?: ToastAction} = 3000
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

export function getToastAction(): ToastAction | null {
    return toastAction;
}

export function getLiveApply(): boolean {
    return liveApply;
}
export function setLiveApply(v: boolean): void {
    liveApply = v;
    writeBoolPref(STORAGE_KEYS.liveApply, v);
}

export function getTargetsVisible(): boolean {
    return targetsVisible;
}
export function setTargetsVisible(v: boolean): void {
    targetsVisible = v;
    writeBoolPref(STORAGE_KEYS.targetsVisible, v);
}
export function toggleTargetsVisible(): void {
    setTargetsVisible(!targetsVisible);
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
