// Wallhaven search state
// Loads defaults from ~/.config/aether/wallhaven.json (via Go),
// persists changes back to both localStorage and the config file.

let configLoaded = false;

let query = $state('');
let categories = $state('111');
let purity = $state('100');
let sorting = $state('date_added');
let order = $state('desc');
let page = $state(1);
let atleast = $state('1920x1080');
let colorFilter = $state('');
let apiKey = $state('');

let results = $state<any[]>([]);
let totalPages = $state(0);
let totalResults = $state(0);
let isSearching = $state(false);

// Load config from ~/.config/aether/wallhaven.json on startup
loadConfigFromFile();

async function loadConfigFromFile() {
    try {
        const {GetWallhavenConfig, SetWallhavenAPIKey} = await import(
            '../../../wailsjs/go/main/App'
        );
        const config = await GetWallhavenConfig();
        if (config) {
            if (config.apiKey) {
                apiKey = config.apiKey;
                SetWallhavenAPIKey(config.apiKey);
            }
            if (config.categories) categories = config.categories;
            if (config.purity) purity = config.purity;
            if (config.sorting) sorting = config.sorting;
            if (config.resolutions) atleast = config.resolutions;
            if (config.order) order = config.order;
            configLoaded = true;
        }
    } catch {}
}

function persist() {
    // Save to Go config file
    import('../../../wailsjs/go/main/App')
        .then(({SaveWallhavenConfig}) => {
            SaveWallhavenConfig({
                apiKey,
                categories,
                purity,
                sorting,
                order,
                resolutions: atleast,
                purityControlsEnabled: true,
            });
        })
        .catch(() => {});
}

// --- Getters ---
export function getQuery(): string {
    return query;
}
export function getCategories(): string {
    return categories;
}
export function getPurity(): string {
    return purity;
}
export function getSorting(): string {
    return sorting;
}
export function getOrder(): string {
    return order;
}
export function getPage(): number {
    return page;
}
export function getAtleast(): string {
    return atleast;
}
export function getColorFilter(): string {
    return colorFilter;
}
export function getApiKey(): string {
    return apiKey;
}
export function getResults(): any[] {
    return results;
}
export function getTotalPages(): number {
    return totalPages;
}
export function getTotalResults(): number {
    return totalResults;
}
export function getIsSearching(): boolean {
    return isSearching;
}

// --- Setters (all persist) ---
export function setQuery(q: string): void {
    query = q;
}
export function setSorting(s: string): void {
    sorting = s;
    persist();
}
export function setOrder(o: string): void {
    order = o;
    persist();
}
export function setPage(p: number): void {
    page = p;
}
export function setAtleast(a: string): void {
    atleast = a;
    persist();
}
export function setColorFilter(c: string): void {
    colorFilter = c;
}
export function setApiKey(k: string): void {
    apiKey = k;
    persist();
    import('../../../wailsjs/go/main/App')
        .then(({SetWallhavenAPIKey}) => {
            SetWallhavenAPIKey(k);
        })
        .catch(() => {});
}

// --- Category helpers (bitmask: General=1xx, Anime=x1x, People=xx1) ---
export function toggleCategory(index: number): void {
    const chars = categories.split('');
    chars[index] = chars[index] === '1' ? '0' : '1';
    if (chars.every(c => c === '0')) return;
    categories = chars.join('');
    persist();
}

// --- Purity helpers (bitmask: SFW=1xx, Sketchy=x1x, NSFW=xx1) ---
export function togglePurity(index: number): void {
    if (index === 2 && !apiKey) return;
    const chars = purity.split('');
    chars[index] = chars[index] === '1' ? '0' : '1';
    if (chars.every(c => c === '0')) return;
    purity = chars.join('');
    persist();
}

// --- Actions ---
export async function search(): Promise<void> {
    page = 1;
    await doSearch();
}

export async function searchPage(): Promise<void> {
    await doSearch();
}

async function doSearch(): Promise<void> {
    isSearching = true;
    try {
        const {SearchWallhaven} = await import('../../../wailsjs/go/main/App');
        const result = await SearchWallhaven({
            q: query,
            categories,
            purity,
            sorting,
            order,
            page,
            atleast,
            colors: colorFilter,
        });
        results = result.data || [];
        totalPages = result.meta?.last_page || 0;
        totalResults = result.meta?.total || 0;
    } catch (e) {
        console.error('Wallhaven search failed:', e);
        results = [];
    } finally {
        isSearching = false;
    }
}
