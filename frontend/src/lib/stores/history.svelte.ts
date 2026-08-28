// Frontend-side undo/redo history

import type {Adjustments, IconThemeSelection} from '$lib/types/theme';

const MAX_HISTORY = 50;

interface Snapshot {
    palette: string[];
    extendedColors: Record<string, string>;
    adjustments: Adjustments;
    iconTheme: IconThemeSelection;
}

let undoStack = $state<Snapshot[]>([]);
let redoStack = $state<Snapshot[]>([]);

let canUndo = $state(false);
let canRedo = $state(false);

function updateFlags() {
    canUndo = undoStack.length > 0;
    canRedo = redoStack.length > 0;
}

export function getCanUndo(): boolean {
    return canUndo;
}
export function getCanRedo(): boolean {
    return canRedo;
}

function snapshotOf(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments,
    iconTheme: IconThemeSelection
): Snapshot {
    return {
        palette: [...palette],
        extendedColors: {...extendedColors},
        adjustments: {...adjustments},
        iconTheme: {...iconTheme},
    };
}

export function pushState(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments,
    iconTheme: IconThemeSelection
): void {
    undoStack = [
        ...undoStack.slice(-(MAX_HISTORY - 1)),
        snapshotOf(palette, extendedColors, adjustments, iconTheme),
    ];
    redoStack = [];
    updateFlags();
}

// Push to undo without clearing redo (used during redo operations)
export function pushUndo(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments,
    iconTheme: IconThemeSelection
): void {
    undoStack = [
        ...undoStack.slice(-(MAX_HISTORY - 1)),
        snapshotOf(palette, extendedColors, adjustments, iconTheme),
    ];
    updateFlags();
}

export function undo(): Snapshot | null {
    if (undoStack.length === 0) return null;
    const snapshot = undoStack[undoStack.length - 1];
    undoStack = undoStack.slice(0, -1);
    updateFlags();
    return snapshot;
}

export function pushRedo(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments,
    iconTheme: IconThemeSelection
): void {
    redoStack = [
        ...redoStack,
        snapshotOf(palette, extendedColors, adjustments, iconTheme),
    ];
    updateFlags();
}

export function redo(): Snapshot | null {
    if (redoStack.length === 0) return null;
    const snapshot = redoStack[redoStack.length - 1];
    redoStack = redoStack.slice(0, -1);
    updateFlags();
    return snapshot;
}
