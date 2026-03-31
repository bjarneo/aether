export type Tab =
    | 'editor'
    | 'wallhaven'
    | 'local'
    | 'favorites'
    | 'blueprints'
    | 'system';

// --- Reactive state ---
let activeTab = $state<Tab>('editor');
let sidebarVisible = $state<boolean>(true);
let toastMessage = $state<string>('');
let toastVisible = $state<boolean>(false);
let colorPickerOpen = $state<boolean>(false);
let colorPickerIndex = $state<number>(-1);
let colorPickerExtKey = $state<string>(''); // non-empty = editing an extended color
let colorPickerOverrideApp = $state<string>(''); // non-empty = editing an app override
let colorPickerOverrideRole = $state<string>(''); // the color role being overridden

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

// --- Actions ---
export function setActiveTab(tab: Tab): void {
    activeTab = tab;
}

export function toggleSidebar(): void {
    sidebarVisible = !sidebarVisible;
}

export function showToast(msg: string, duration = 3000): void {
    toastMessage = msg;
    toastVisible = true;
    setTimeout(() => {
        toastVisible = false;
    }, duration);
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
}
