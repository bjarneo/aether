export async function openURL(url: string): Promise<void> {
    try {
        const {BrowserOpenURL} = await import(
            '../../../wailsjs/runtime/runtime'
        );
        BrowserOpenURL(url);
    } catch {}
}
