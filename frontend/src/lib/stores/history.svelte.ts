// Frontend-side undo/redo history

import type {Adjustments} from '$lib/types/theme';

const MAX_HISTORY = 50;

interface Snapshot {
    palette: string[];
    extendedColors: Record<string, string>;
    adjustments: Adjustments;
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

export function pushState(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments
): void {
    undoStack = [
        ...undoStack.slice(-(MAX_HISTORY - 1)),
        {
            palette: [...palette],
            extendedColors: {...extendedColors},
            adjustments: {...adjustments},
        },
    ];
    redoStack = [];
    updateFlags();
}

// Push to undo without clearing redo (used during redo operations)
export function pushUndo(
    palette: string[],
    extendedColors: Record<string, string>,
    adjustments: Adjustments
): void {
    undoStack = [
        ...undoStack.slice(-(MAX_HISTORY - 1)),
        {
            palette: [...palette],
            extendedColors: {...extendedColors},
            adjustments: {...adjustments},
        },
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
    adjustments: Adjustments
): void {
    redoStack = [
        ...redoStack,
        {
            palette: [...palette],
            extendedColors: {...extendedColors},
            adjustments: {...adjustments},
        },
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
