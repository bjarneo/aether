export interface ColorRoles {
    background: string;
    foreground: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    bright_black: string;
    bright_red: string;
    bright_green: string;
    bright_yellow: string;
    bright_blue: string;
    bright_magenta: string;
    bright_cyan: string;
    bright_white: string;
    accent: string;
    cursor: string;
    selection_foreground: string;
    selection_background: string;
}

export interface Adjustments {
    vibrance: number;
    saturation: number;
    contrast: number;
    brightness: number;
    shadows: number;
    highlights: number;
    hueShift: number;
    temperature: number;
    tint: number;
    gamma: number;
    blackPoint: number;
    whitePoint: number;
}

// Blueprint shape returned by ListBlueprints (Go side returns untyped maps,
// so this mirrors internal/blueprint.Blueprint by hand).
export interface BlueprintPaletteData {
    colors: string[];
    wallpaper?: string;
    wallpaperUrl?: string;
    lightMode?: boolean;
    lockedColors?: number[];
    extendedColors?: Record<string, string>;
    additionalImages?: string[];
    wallpaperSource?: string;
}

export interface Blueprint {
    name: string;
    palette: BlueprintPaletteData;
    adjustments?: Record<string, number>;
    appOverrides?: Record<string, Record<string, string>>;
    settings?: Record<string, unknown>;
    timestamp: number;
    path?: string;
    filename?: string;
}

export interface Settings {
    includeGtk: boolean;
    includeZed: boolean;
    includeVscode: boolean;
    includeNeovim: boolean;
    selectedNeovimConfig: string;
    videoCpuMode: boolean;
    // Per-app skip list. Keys are the app names returned by
    // GetTemplateColors (alacritty, hyprland, …). True = skip the
    // template during ApplyTheme / GenerateOnly.
    excludedApps?: Record<string, boolean>;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
    vibrance: 0,
    saturation: 0,
    contrast: 0,
    brightness: 0,
    shadows: 0,
    highlights: 0,
    hueShift: 0,
    temperature: 0,
    tint: 0,
    gamma: 1.0,
    blackPoint: 0,
    whitePoint: 0,
};

export const DEFAULT_PALETTE: string[] = [
    '#1e1e2e',
    '#f38ba8',
    '#a6e3a1',
    '#f9e2af',
    '#89b4fa',
    '#cba6f7',
    '#94e2d5',
    '#cdd6f4',
    '#45475a',
    '#f38ba8',
    '#a6e3a1',
    '#f9e2af',
    '#89b4fa',
    '#cba6f7',
    '#94e2d5',
    '#ffffff',
];
