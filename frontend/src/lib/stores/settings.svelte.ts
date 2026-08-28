import type {Settings} from '$lib/types/theme';
import {SPECIAL_APP_FLAGS} from '$lib/constants/apps';

const defaults: Settings = {
    wallpaperFolder: '',
    includeZed: false,
    includeVscode: false,
    includeNeovim: false,
    selectedNeovimConfig: '',
    includedApps: {},
};

let settings = $state<Settings>({...defaults});

// Load saved settings on startup
loadSettings();

async function loadSettings() {
    try {
        const {GetSettings} = await import('../../../wailsjs/go/main/App');
        const saved = await GetSettings();
        let cleanedLegacySettings = false;
        if (saved && typeof saved === 'object') {
            const cleaned = {...saved};
            if ('includeGtk' in cleaned) {
                delete cleaned.includeGtk;
                cleanedLegacySettings = true;
            }
            if ('excludedApps' in cleaned) {
                delete cleaned.excludedApps;
                cleanedLegacySettings = true;
            }
            settings = {...defaults, ...cleaned};
            settings = {
                ...settings,
                includedApps: settings.includedApps ?? {},
            };
            if (
                settings.selectedNeovimConfig &&
                !settings.includedApps?.neovim
            ) {
                settings = {
                    ...settings,
                    includeNeovim: true,
                    includedApps: {
                        ...(settings.includedApps ?? {}),
                        neovim: true,
                    },
                };
                cleanedLegacySettings = true;
            }
        }
        if (cleanedLegacySettings) persist();
    } catch {}
}

function persist() {
    import('../../../wailsjs/go/main/App')
        .then(({SaveSettings}) => {
            SaveSettings(settings);
        })
        .catch(() => {});
}

export function getSettings(): Settings {
    return settings;
}

export function updateSettings(partial: Partial<Settings>): void {
    settings = {...settings, ...partial};
    persist();
}

export function isAppIncluded(app: string): boolean {
    return !!settings.includedApps?.[app];
}

export function setAppIncluded(app: string, enabled: boolean): void {
    const current = {...(settings.includedApps ?? {})};
    if (enabled) {
        current[app] = true;
    } else {
        delete current[app];
    }

    const flag = SPECIAL_APP_FLAGS[app];
    updateSettings({
        includedApps: current,
        ...(flag ? {[flag]: enabled} : {}),
    });
}

export function toggleAppInclusion(app: string): void {
    setAppIncluded(app, !isAppIncluded(app));
}
