export interface OmarchyCapabilities {
    available: boolean;
    version: string;
    themesDir: string;
    stateDir: string;
    currentTheme: string;
    overrideApps: string[];
}

const EMPTY_CAPABILITIES: OmarchyCapabilities = {
    available: false,
    version: '',
    themesDir: '',
    stateDir: '',
    currentTheme: '',
    overrideApps: [],
};

let capabilities = $state<OmarchyCapabilities>({...EMPTY_CAPABILITIES});
let initialized = false;
let initialization: Promise<void> | null = null;

export function getOmarchyCapabilities(): OmarchyCapabilities {
    return capabilities;
}

export function getOmarchyAvailable(): boolean {
    return capabilities.available;
}

export async function refreshOmarchyCapabilities(): Promise<void> {
    try {
        const {GetOmarchyCapabilities} = await import(
            '../../../wailsjs/go/main/App'
        );
        capabilities = await GetOmarchyCapabilities();
    } catch {
        capabilities = {...EMPTY_CAPABILITIES};
    }
    initialized = true;
}

export function initOmarchyCapabilities(): Promise<void> {
    if (initialized) return Promise.resolve();
    if (!initialization) {
        initialization = refreshOmarchyCapabilities().finally(() => {
            initialization = null;
        });
    }
    return initialization;
}
