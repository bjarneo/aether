import type {Settings} from '$lib/types/theme';
import {ALWAYS_INCLUDED_APPS} from '$lib/constants/apps';

const defaults: Settings = {
    includeGtk: false,
    includeZed: true,
    includeVscode: false,
    includeNeovim: true,
    selectedNeovimConfig: '',
    videoCpuMode: false,
    excludedApps: {},
};

let settings = $state<Settings>({...defaults});

// Load saved settings on startup
loadSettings();

async function loadSettings() {
    try {
        const {GetSettings} = await import('../../../wailsjs/go/main/App');
        const saved = await GetSettings();
        if (saved && typeof saved === 'object') {
            settings = {...defaults, ...saved};
        }
        // Clear any stale exclusions for apps we now mandate.
        const excluded = settings.excludedApps;
        if (
            excluded &&
            Object.keys(excluded).some(k => ALWAYS_INCLUDED_APPS.has(k))
        ) {
            const cleaned = {...excluded};
            for (const k of ALWAYS_INCLUDED_APPS) delete cleaned[k];
            settings = {...settings, excludedApps: cleaned};
            persist();
        }
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

export function isAppExcluded(app: string): boolean {
    return !!settings.excludedApps?.[app];
}

export function toggleAppExclusion(app: string): void {
    const current = {...(settings.excludedApps ?? {})};
    if (current[app]) {
        delete current[app];
    } else {
        current[app] = true;
    }
    updateSettings({excludedApps: current});
}
