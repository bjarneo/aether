// localStorage keys used by the app. Centralised so it's obvious what
// state crosses session boundaries — and so a key rename never silently
// orphans a user's saved data because of a typo in one callsite.
//
// Mixing kebab (`aether-foo`) and dot (`aether.foo`) is intentional:
// the dot-notation keys predate the kebab ones and are preserved as-is
// so existing users don't lose their data on upgrade. New keys should
// use the kebab convention.
export const STORAGE_KEYS = {
    // Also hardcoded in frontend/index.html for the first-paint
    // anti-flash inliner — keep both in sync if the literal changes.
    themeColors: 'aether-theme-colors',
    liveApply: 'aether-live-apply',
    targetsVisible: 'aether-targets-visible',
    zoom: 'aether-zoom',
    recentColors: 'aether.recentColors',
    customPresets: 'aether.customPresets',
} as const;
