import type {Settings} from '$lib/types/theme';

const defaults: Settings = {
    includeGtk: false,
    includeZed: true,
    includeVscode: false,
    includeNeovim: true,
    selectedNeovimConfig: '',
    videoCpuMode: false,
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
