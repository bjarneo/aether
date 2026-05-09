export async function openURL(url: string): Promise<void> {
    try {
        const {BrowserOpenURL} = await import(
            '../../../wailsjs/runtime/runtime'
        );
        BrowserOpenURL(url);
    } catch {}
}

export function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
        return false;
    }
}
