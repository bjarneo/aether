/**
 * Global keyboard shortcut handler.
 * Registers shortcuts once and dispatches to callbacks.
 */

type ShortcutHandler = () => void;

const shortcuts: Map<string, ShortcutHandler> = new Map();

function keyToString(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey || e.metaKey) parts.push('ctrl');
    if (e.shiftKey) parts.push('shift');
    if (e.altKey) parts.push('alt');
    parts.push(e.key.toLowerCase());
    return parts.join('+');
}

export function registerShortcut(combo: string, handler: ShortcutHandler) {
    shortcuts.set(combo.toLowerCase(), handler);
}

export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        // Don't intercept when typing in inputs
        const target = e.target as HTMLElement;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            // Allow Escape even in inputs
            if (e.key !== 'Escape') return;
        }

        const key = keyToString(e);
        const handler = shortcuts.get(key);
        if (handler) {
            e.preventDefault();
            handler();
        }
    });
}
