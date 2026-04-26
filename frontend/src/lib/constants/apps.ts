import type {Settings} from '$lib/types/theme';

// App keys that have a dedicated boolean flag in Settings. Toggling these
// drives apply-side install steps (ApplyGTKTheme, ApplyZedTheme,
// ApplyVSCodeTheme, SelectedNeovimConfig), not just template writing —
// they cannot be collapsed into the generic excludedApps list.
export const SPECIAL_APP_FLAGS: Record<string, keyof Settings> = {
    gtk: 'includeGtk',
    zed: 'includeZed',
    vscode: 'includeVscode',
    neovim: 'includeNeovim',
};

export const SPECIAL_APP_KEYS = new Set(Object.keys(SPECIAL_APP_FLAGS));

// Order in which specials should appear in UI lists.
export const SPECIAL_APP_ORDER: readonly string[] = [
    'neovim',
    'gtk',
    'zed',
    'vscode',
];

// Templates that are always written and never user-togglable. Hidden from
// the Apps sidebar and the Targets strip. colors.toml is the canonical
// machine-readable export consumed by external tools, so opting out of it
// would silently break integrations.
export const ALWAYS_INCLUDED_APPS = new Set(['colors']);

// Pretty labels for known templates. Anything not listed falls back to a
// title-cased version of the key.
export const APP_LABELS: Record<string, string> = {
    gtk: 'GTK',
    zed: 'Zed',
    vscode: 'VS Code',
    neovim: 'Neovim',
    alacritty: 'Alacritty',
    btop: 'Btop',
    chromium: 'Chromium',
    colors: 'Colors (.toml)',
    ghostty: 'Ghostty',
    hyprland: 'Hyprland',
    hyprlock: 'Hyprlock',
    icons: 'Icons',
    kitty: 'Kitty',
    mako: 'Mako',
    swayosd: 'SwayOSD',
    vencord: 'Vencord',
    walker: 'Walker',
    warp: 'Warp',
    waybar: 'Waybar',
    wofi: 'Wofi',
    zellij: 'Zellij',
};

export function appLabel(key: string): string {
    return APP_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
