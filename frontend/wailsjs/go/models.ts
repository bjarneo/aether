export namespace color {
    export class Adjustments {
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

        static createFrom(source: any = {}) {
            return new Adjustments(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.vibrance = source['vibrance'];
            this.saturation = source['saturation'];
            this.contrast = source['contrast'];
            this.brightness = source['brightness'];
            this.shadows = source['shadows'];
            this.highlights = source['highlights'];
            this.hueShift = source['hueShift'];
            this.temperature = source['temperature'];
            this.tint = source['tint'];
            this.gamma = source['gamma'];
            this.blackPoint = source['blackPoint'];
            this.whitePoint = source['whitePoint'];
        }
    }
}

export namespace favorites {
    export class Favorite {
        path: string;
        type?: string;
        data?: Record<string, any>;

        static createFrom(source: any = {}) {
            return new Favorite(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.path = source['path'];
            this.type = source['type'];
            this.data = source['data'];
        }
    }
}

export namespace ipc {
    export class Request {
        cmd: string;
        path?: string;
        mode?: string;
        name?: string;
        index?: number;
        value?: string;
        palette?: string[];
        vibrance?: number;
        saturation?: number;
        contrast?: number;
        brightness?: number;
        shadows?: number;
        highlights?: number;
        hue_shift?: number;
        temperature?: number;
        tint?: number;
        gamma?: number;
        black_point?: number;
        white_point?: number;
        light_mode?: boolean;

        static createFrom(source: any = {}) {
            return new Request(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.cmd = source['cmd'];
            this.path = source['path'];
            this.mode = source['mode'];
            this.name = source['name'];
            this.index = source['index'];
            this.value = source['value'];
            this.palette = source['palette'];
            this.vibrance = source['vibrance'];
            this.saturation = source['saturation'];
            this.contrast = source['contrast'];
            this.brightness = source['brightness'];
            this.shadows = source['shadows'];
            this.highlights = source['highlights'];
            this.hue_shift = source['hue_shift'];
            this.temperature = source['temperature'];
            this.tint = source['tint'];
            this.gamma = source['gamma'];
            this.black_point = source['black_point'];
            this.white_point = source['white_point'];
            this.light_mode = source['light_mode'];
        }
    }
    export class Response {
        ok: boolean;
        error?: string;
        palette?: string[];
        light_mode?: boolean;
        mode?: string;
        wallpaper?: string;
        data?: number[];

        static createFrom(source: any = {}) {
            return new Response(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.ok = source['ok'];
            this.error = source['error'];
            this.palette = source['palette'];
            this.light_mode = source['light_mode'];
            this.mode = source['mode'];
            this.wallpaper = source['wallpaper'];
            this.data = source['data'];
        }
    }
}

export namespace main {
    export class ApplyThemeRequest {
        palette: string[];
        wallpaperPath: string;
        lightMode: boolean;
        additionalImages: string[];
        extendedColors: Record<string, string>;
        settings: theme.Settings;
        appOverrides: Record<string, any>;

        static createFrom(source: any = {}) {
            return new ApplyThemeRequest(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.palette = source['palette'];
            this.wallpaperPath = source['wallpaperPath'];
            this.lightMode = source['lightMode'];
            this.additionalImages = source['additionalImages'];
            this.extendedColors = source['extendedColors'];
            this.settings = this.convertValues(
                source['settings'],
                theme.Settings
            );
            this.appOverrides = source['appOverrides'];
        }

        convertValues(a: any, classs: any, asMap: boolean = false): any {
            if (!a) {
                return a;
            }
            if (a.slice && a.map) {
                return (a as any[]).map(elem =>
                    this.convertValues(elem, classs)
                );
            } else if ('object' === typeof a) {
                if (asMap) {
                    for (const key of Object.keys(a)) {
                        a[key] = new classs(a[key]);
                    }
                    return a;
                }
                return new classs(a);
            }
            return a;
        }
    }
    export class ExportThemeRequest {
        name: string;
        includedApps: string[];
        palette: string[];
        wallpaperPath: string;
        lightMode: boolean;
        additionalImages: string[];
        extendedColors: Record<string, string>;
        installToOmarchy: boolean;
        appOverrides: Record<string, any>;

        static createFrom(source: any = {}) {
            return new ExportThemeRequest(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.name = source['name'];
            this.includedApps = source['includedApps'];
            this.palette = source['palette'];
            this.wallpaperPath = source['wallpaperPath'];
            this.lightMode = source['lightMode'];
            this.additionalImages = source['additionalImages'];
            this.extendedColors = source['extendedColors'];
            this.installToOmarchy = source['installToOmarchy'];
            this.appOverrides = source['appOverrides'];
        }
    }
    export class ImportResult {
        colors: string[];
        name: string;
        path: string;
        wallpaperPath: string;
        lightMode: boolean;

        static createFrom(source: any = {}) {
            return new ImportResult(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.colors = source['colors'];
            this.name = source['name'];
            this.path = source['path'];
            this.wallpaperPath = source['wallpaperPath'];
            this.lightMode = source['lightMode'];
        }
    }
    export class SaveBlueprintRequest {
        name: string;
        palette: string[];
        wallpaperPath: string;
        lightMode: boolean;
        additionalImages: string[];
        lockedColors: number[];
        extendedColors: Record<string, string>;
        appOverrides: Record<string, any>;
        adjustments: Record<string, number>;

        static createFrom(source: any = {}) {
            return new SaveBlueprintRequest(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.name = source['name'];
            this.palette = source['palette'];
            this.wallpaperPath = source['wallpaperPath'];
            this.lightMode = source['lightMode'];
            this.additionalImages = source['additionalImages'];
            this.lockedColors = source['lockedColors'];
            this.extendedColors = source['extendedColors'];
            this.appOverrides = source['appOverrides'];
            this.adjustments = source['adjustments'];
        }
    }
}

export namespace omarchy {
    export class Theme {
        name: string;
        path: string;
        colors: string[];
        background: string;
        foreground: string;
        wallpapers: string[];
        isSymlink: boolean;
        isCurrentTheme: boolean;
        isAetherGenerated: boolean;

        static createFrom(source: any = {}) {
            return new Theme(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.name = source['name'];
            this.path = source['path'];
            this.colors = source['colors'];
            this.background = source['background'];
            this.foreground = source['foreground'];
            this.wallpapers = source['wallpapers'];
            this.isSymlink = source['isSymlink'];
            this.isCurrentTheme = source['isCurrentTheme'];
            this.isAetherGenerated = source['isAetherGenerated'];
        }
    }
}

export namespace theme {
    export class ApplyResult {
        success: boolean;
        isOmarchy: boolean;
        themePath: string;

        static createFrom(source: any = {}) {
            return new ApplyResult(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.success = source['success'];
            this.isOmarchy = source['isOmarchy'];
            this.themePath = source['themePath'];
        }
    }
    export class Settings {
        includeGtk: boolean;
        includeZed: boolean;
        includeVscode: boolean;
        includeNeovim: boolean;
        selectedNeovimConfig: string;
        excludedApps?: Record<string, boolean>;

        static createFrom(source: any = {}) {
            return new Settings(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.includeGtk = source['includeGtk'];
            this.includeZed = source['includeZed'];
            this.includeVscode = source['includeVscode'];
            this.includeNeovim = source['includeNeovim'];
            this.selectedNeovimConfig = source['selectedNeovimConfig'];
            this.excludedApps = source['excludedApps'];
        }
    }
}

export namespace wallhaven {
    export class SearchMeta {
        current_page: number;
        last_page: number;
        total: number;
        seed?: string;

        static createFrom(source: any = {}) {
            return new SearchMeta(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.current_page = source['current_page'];
            this.last_page = source['last_page'];
            this.total = source['total'];
            this.seed = source['seed'];
        }
    }
    export class SearchParams {
        q: string;
        categories: string;
        purity: string;
        sorting: string;
        order: string;
        page: number;
        atleast: string;
        colors: string;

        static createFrom(source: any = {}) {
            return new SearchParams(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.q = source['q'];
            this.categories = source['categories'];
            this.purity = source['purity'];
            this.sorting = source['sorting'];
            this.order = source['order'];
            this.page = source['page'];
            this.atleast = source['atleast'];
            this.colors = source['colors'];
        }
    }
    export class WallpaperInfo {
        id: string;
        url: string;
        path: string;
        resolution: string;
        file_size: number;
        category: string;
        purity: string;
        thumbs: Record<string, string>;

        static createFrom(source: any = {}) {
            return new WallpaperInfo(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.id = source['id'];
            this.url = source['url'];
            this.path = source['path'];
            this.resolution = source['resolution'];
            this.file_size = source['file_size'];
            this.category = source['category'];
            this.purity = source['purity'];
            this.thumbs = source['thumbs'];
        }
    }
    export class SearchResult {
        data: WallpaperInfo[];
        meta: SearchMeta;

        static createFrom(source: any = {}) {
            return new SearchResult(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.data = this.convertValues(source['data'], WallpaperInfo);
            this.meta = this.convertValues(source['meta'], SearchMeta);
        }

        convertValues(a: any, classs: any, asMap: boolean = false): any {
            if (!a) {
                return a;
            }
            if (a.slice && a.map) {
                return (a as any[]).map(elem =>
                    this.convertValues(elem, classs)
                );
            } else if ('object' === typeof a) {
                if (asMap) {
                    for (const key of Object.keys(a)) {
                        a[key] = new classs(a[key]);
                    }
                    return a;
                }
                return new classs(a);
            }
            return a;
        }
    }
}

export namespace wallpaper {
    export class WallpaperInfo {
        path: string;
        name: string;
        size: number;
        modTime: number;

        static createFrom(source: any = {}) {
            return new WallpaperInfo(source);
        }

        constructor(source: any = {}) {
            if ('string' === typeof source) source = JSON.parse(source);
            this.path = source['path'];
            this.name = source['name'];
            this.size = source['size'];
            this.modTime = source['modTime'];
        }
    }
}
