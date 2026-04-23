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
let isLoadingMore = $state(false);

export type CardSize = 'small' | 'medium' | 'large';
let cardSize = $state<CardSize>('small');

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
export function getTotalResults(): number {
    return totalResults;
}
export function getIsSearching(): boolean {
    return isSearching;
}
export function getIsLoadingMore(): boolean {
    return isLoadingMore;
}
export function getHasMore(): boolean {
    return totalPages > 0 && page < totalPages;
}
export function getCardSize(): CardSize {
    return cardSize;
}
export function setCardSize(s: CardSize): void {
    cardSize = s;
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
    await doSearch(false);
}

export async function loadMore(): Promise<void> {
    if (isSearching || isLoadingMore) return;
    if (totalPages > 0 && page >= totalPages) return;
    page = page + 1;
    await doSearch(true);
}

async function doSearch(append: boolean): Promise<void> {
    if (append) isLoadingMore = true;
    else isSearching = true;
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
        const data = result.data || [];
        if (append) {
            const seen = new Set(results.map(r => r.id));
            results = [...results, ...data.filter((r: any) => !seen.has(r.id))];
        } else {
            results = data;
        }
        totalPages = result.meta?.last_page || 0;
        totalResults = result.meta?.total || 0;
    } catch (e) {
        console.error('Wallhaven search failed:', e);
        if (append) page = Math.max(1, page - 1);
        else results = [];
    } finally {
        if (append) isLoadingMore = false;
        else isSearching = false;
    }
}
