import {showToast} from '$lib/stores/ui.svelte';
import type {main} from '../../../wailsjs/go/models';

export type ExportPhase = 'download' | 'archive';

export type ExportState = {
    active: boolean;
    phase: ExportPhase;
    index: number; // 1-based, counts items handled in the current phase
    total: number;
    name: string; // file currently being handled
    zipPath: string;
};

type Skip = {path: string; reason: string};

type ExportResult = {
    zipPath: string;
    total: number;
    exported: number;
    skipped: Skip[] | null;
};

const IDLE: ExportState = {
    active: false,
    phase: 'download',
    index: 0,
    total: 0,
    name: '',
    zipPath: '',
};

let state = $state<ExportState>({...IDLE});
let eventsReady = false;
// Bumped by every terminal event. The backend starts working the moment the
// directory picker closes, which can be before ExportFavorites' promise
// settles, so startExport uses this to tell "my run is still going" from
// "my run already finished".
let runSeq = 0;

export function getExportState(): ExportState {
    return state;
}

/**
 * Starts an export of the given favorite paths. The backend opens the
 * directory picker itself, so a dismissed dialog surfaces as a "cancelled"
 * error we swallow — same convention as the theme import flow in ActionBar.
 */
export async function startExport(paths: string[]): Promise<void> {
    if (state.active || paths.length === 0) return;

    const seq = runSeq;
    try {
        const {ExportFavorites} = await import('../../../wailsjs/go/main/App');
        const zipPath = await ExportFavorites({
            paths,
        } as unknown as main.ExportFavoritesRequest);

        if (runSeq !== seq) return; // already finished while we were awaiting
        state = state.active
            ? {...state, zipPath} // progress is already flowing; don't rewind it
            : // Seed the bar so it shows up the moment the picker closes
              // rather than only after the first download lands.
              {...IDLE, active: true, total: paths.length, zipPath};
    } catch (e: any) {
        const message = e?.message ?? String(e);
        if (message.includes('cancelled')) return;
        showToast(message || 'Export failed');
    }
}

export async function cancelExport(): Promise<void> {
    if (!state.active) return;
    try {
        const {CancelFavoritesExport} = await import(
            '../../../wailsjs/go/main/App'
        );
        await CancelFavoritesExport();
    } catch {
        // The backend either finished or was never running; the terminal event
        // still resets the state.
    }
}

/**
 * Subscribes to the backend's export events. Called once from App.svelte so
 * progress survives switching tabs away from Favorites.
 */
export async function initExportEvents(): Promise<void> {
    if (eventsReady) return;
    eventsReady = true;

    const {EventsOn, BrowserOpenURL} = await import(
        '../../../wailsjs/runtime/runtime'
    );

    EventsOn(
        'favorites-export-progress',
        (p: {phase: ExportPhase; index: number; total: number; name: string}) =>
            (state = {...state, active: true, ...p})
    );

    EventsOn('favorites-export-completed', (result: ExportResult) => {
        runSeq++;
        state = {...IDLE};
        const skipped = result.skipped?.length ?? 0;
        const summary = skipped
            ? `Exported ${result.exported} of ${result.total} favorites`
            : `Exported ${result.exported} favorite${result.exported === 1 ? '' : 's'}`;
        const dir = result.zipPath.slice(0, result.zipPath.lastIndexOf('/'));
        showToast(`${summary} to ${result.zipPath}`, {
            duration: 8000,
            action: {
                label: 'Open folder',
                run: () => BrowserOpenURL('file://' + dir),
            },
        });
    });

    EventsOn('favorites-export-failed', (p: {error: string}) => {
        runSeq++;
        state = {...IDLE};
        showToast(p?.error || 'Export failed');
    });

    EventsOn('favorites-export-cancelled', () => {
        runSeq++;
        state = {...IDLE};
        showToast('Export cancelled');
    });

    // The backend can already be exporting if the frontend reloaded mid-run
    // (dev hot reload); progress events refill the details.
    try {
        const {IsFavoritesExportRunning} = await import(
            '../../../wailsjs/go/main/App'
        );
        if (await IsFavoritesExportRunning()) {
            state = {...state, active: true};
        }
    } catch {
        // No backend (browser-only dev) — nothing to recover.
    }
}
