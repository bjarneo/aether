<script lang="ts">
    import {onMount} from 'svelte';
    import HeaderBar from '$lib/components/layout/HeaderBar.svelte';
    import ActionBar from '$lib/components/layout/ActionBar.svelte';
    import ThemeEditor from '$lib/components/editor/ThemeEditor.svelte';
    import WallhavenBrowser from '$lib/components/wallhaven/WallhavenBrowser.svelte';
    import LocalBrowser from '$lib/components/local/LocalBrowser.svelte';
    import FavoritesView from '$lib/components/favorites/FavoritesView.svelte';
    import BlueprintsView from '$lib/components/blueprints/BlueprintsView.svelte';
    import BlueprintWidget from '$lib/components/blueprints/BlueprintWidget.svelte';
    import OmarchyThemes from '$lib/components/blueprints/OmarchyThemes.svelte';
    import {
        getActiveTab,
        setActiveTab,
        showToast,
        closeColorPicker,
        getColorPickerOpen,
        getColorPickerIndex,
        getColorPickerExtKey,
        getColorPickerOverrideApp,
        getColorPickerOverrideRole,
    } from '$lib/stores/ui.svelte';
    import {
        getIsApplying,
        setIsApplying,
        setWallpaperPath,
        getPalette,
        getWallpaperPath,
        getLightMode,
        getAdditionalImages,
        getExtendedColors,
        getAppOverrides,
        getAdjustments,
        setAdjustments,
        setPalette,
        setAdjustedExtendedColors,
        setColor,
        setExtendedColor,
        setAppOverride,
    } from '$lib/stores/theme.svelte';
    import {getSettings} from '$lib/stores/settings.svelte';
    import {
        undo as historyUndo,
        redo as historyRedo,
        pushRedo,
        pushState,
        pushUndo,
    } from '$lib/stores/history.svelte';
    import Toast from '$lib/components/shared/Toast.svelte';
    import ColorPickerDialog from '$lib/components/color-picker/ColorPickerDialog.svelte';
    import AboutDialog from '$lib/components/shared/AboutDialog.svelte';
    import KeymapDialog from '$lib/components/shared/KeymapDialog.svelte';
    import {initKeyboardShortcuts, registerShortcut} from '$lib/utils/keyboard';

    let showAbout = $state(false);
    let showKeymap = $state(false);
    let activeTab = $derived(getActiveTab());
    let widgetMode = $state(false);

    onMount(async () => {
        try {
            const {IsWidgetMode} = await import('../wailsjs/go/main/App');
            widgetMode = await IsWidgetMode();
        } catch {}
        if (widgetMode) return; // Skip full app setup in widget mode

        // Focus a specific tab if requested via --tab flag
        try {
            const {GetFocusTab} = await import('../wailsjs/go/main/App');
            const tab = await GetFocusTab();
            if (tab) setActiveTab(tab as any);
        } catch {}

        initKeyboardShortcuts();

        // Ctrl+Z - Undo
        registerShortcut('ctrl+z', () => {
            const snapshot = historyUndo();
            if (snapshot) {
                pushRedo(getPalette(), getExtendedColors(), getAdjustments());
                setPalette(snapshot.palette, true);
                setAdjustedExtendedColors(snapshot.extendedColors);
                setAdjustments(snapshot.adjustments);
            }
        });

        // Ctrl+Shift+Z - Redo
        registerShortcut('ctrl+shift+z', () => {
            const snapshot = historyRedo();
            if (snapshot) {
                pushUndo(getPalette(), getExtendedColors(), getAdjustments());
                setPalette(snapshot.palette, true);
                setAdjustedExtendedColors(snapshot.extendedColors);
                setAdjustments(snapshot.adjustments);
            }
        });

        // Ctrl+Enter - Apply theme
        registerShortcut('ctrl+enter', async () => {
            if (getIsApplying()) return;
            setIsApplying(true);
            try {
                const {ApplyTheme} = await import('../wailsjs/go/main/App');
                const result = await ApplyTheme({
                    palette: getPalette(),
                    wallpaperPath: getWallpaperPath(),
                    lightMode: getLightMode(),
                    additionalImages: getAdditionalImages(),
                    extendedColors: getExtendedColors(),
                    settings: getSettings(),
                    appOverrides: getAppOverrides(),
                });
                if (result.success) showToast('Theme applied');
            } catch {
                showToast('Failed to apply theme');
            } finally {
                setIsApplying(false);
            }
        });

        // Ctrl+S - Save blueprint
        registerShortcut('ctrl+s', () => {
            showToast('Use the Blueprints tab to save');
        });

        // Shift+C - Copy hex from active color picker
        registerShortcut('shift+c', () => {
            if (!getColorPickerOpen()) return;
            // Read the hex value straight from the picker's input field
            const input = document.querySelector<HTMLInputElement>(
                '[data-color-hex-input]'
            );
            const hex = input?.value || '';
            if (hex) {
                navigator.clipboard.writeText(hex).then(() => {
                    showToast(`Copied ${hex}`);
                });
            }
        });

        // Shift+V - Paste hex into active swatch
        registerShortcut('shift+v', () => {
            if (!getColorPickerOpen()) return;
            navigator.clipboard.readText().then(text => {
                let hex = text.trim();
                // Accept with or without # prefix
                if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                    hex = '#' + hex;
                }
                if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
                    showToast('Clipboard is not a valid hex color');
                    return;
                }
                const overrideApp = getColorPickerOverrideApp();
                const overrideRole = getColorPickerOverrideRole();
                const extKey = getColorPickerExtKey();
                if (overrideApp && overrideRole) {
                    setAppOverride(overrideApp, overrideRole, hex);
                } else if (extKey) {
                    setExtendedColor(extKey, hex);
                } else {
                    setColor(getColorPickerIndex(), hex);
                }
                showToast(`Pasted ${hex}`);
            });
        });

        // Ctrl+= / Ctrl+- / Ctrl+0 - Zoom controls
        const ZOOM_STEP = 0.1;
        const ZOOM_MIN = 0.5;
        const ZOOM_MAX = 2.0;
        const ZOOM_DEFAULT = 1.0;

        function getZoom(): number {
            return parseFloat(localStorage.getItem('aether-zoom') || '1');
        }

        function applyZoom(level: number) {
            const clamped = Math.min(
                ZOOM_MAX,
                Math.max(ZOOM_MIN, Math.round(level * 100) / 100)
            );
            document.documentElement.style.zoom = String(clamped);
            localStorage.setItem('aether-zoom', String(clamped));
        }

        // Restore saved zoom level
        applyZoom(getZoom());

        // Ctrl++ (on standard keyboards, + is Shift+=, so e.key is "+")
        registerShortcut('ctrl+shift++', () => {
            applyZoom(getZoom() + ZOOM_STEP);
        });

        // Ctrl++ via numpad (no shift needed)
        registerShortcut('ctrl++', () => {
            applyZoom(getZoom() + ZOOM_STEP);
        });

        registerShortcut('ctrl+-', () => {
            applyZoom(getZoom() - ZOOM_STEP);
        });

        registerShortcut('ctrl+0', () => {
            applyZoom(ZOOM_DEFAULT);
        });

        // Ctrl+K - Show keymap
        registerShortcut('ctrl+k', () => {
            showKeymap = !showKeymap;
        });

        // Escape - Close modals
        registerShortcut('escape', () => {
            if (getColorPickerOpen()) closeColorPicker();
            else if (showKeymap) showKeymap = false;
            else if (showAbout) showAbout = false;
        });

        // Listen for events from Go
        (async () => {
            try {
                const {EventsOn} = await import('../wailsjs/runtime/runtime');

                // Apply theme colors from aether.override.css as CSS custom properties
                EventsOn(
                    'theme-colors-changed',
                    (colors: Record<string, string>) => {
                        const root = document.documentElement;
                        for (const [name, value] of Object.entries(colors)) {
                            root.style.setProperty(`--aether-${name}`, value);
                        }
                        // Map key GTK colors to our Tailwind theme tokens
                        if (colors.background) {
                            root.style.setProperty(
                                '--color-bg-primary',
                                colors.background
                            );
                            root.style.setProperty(
                                '--color-bg-secondary',
                                colors.background
                            );
                            document.body.style.background = colors.background;
                        }
                        if (colors.foreground) {
                            root.style.setProperty(
                                '--color-fg-primary',
                                colors.foreground
                            );
                            document.body.style.color = colors.foreground;
                        }
                        if (colors.blue) {
                            root.style.setProperty(
                                '--color-accent',
                                colors.blue
                            );
                        }
                        if (colors.red) {
                            root.style.setProperty(
                                '--color-destructive',
                                colors.red
                            );
                        }
                        if (colors.green) {
                            root.style.setProperty(
                                '--color-success',
                                colors.green
                            );
                        }
                        if (colors.yellow) {
                            root.style.setProperty(
                                '--color-warning',
                                colors.yellow
                            );
                        }
                        // Cache for instant restore on next launch
                        try {
                            localStorage.setItem(
                                'aether-theme-colors',
                                JSON.stringify(colors)
                            );
                        } catch {}
                    }
                );
            } catch {}
        })();

        // Wails native file drop handler
        (async () => {
            try {
                const {OnFileDrop} = await import('../wailsjs/runtime/runtime');
                OnFileDrop(async (x: number, y: number, paths: string[]) => {
                    try {
                        const {HandleDroppedFiles} = await import(
                            '../wailsjs/go/main/App'
                        );
                        const path = await HandleDroppedFiles(paths);
                        if (path) {
                            setWallpaperPath(path);
                            setActiveTab('editor');
                            showToast(
                                'Wallpaper selected — click Extract to generate palette'
                            );
                        }
                    } catch (e: any) {
                        showToast(
                            'Drop failed: ' + (e?.message || 'unknown error')
                        );
                    }
                }, true);
            } catch {}
        })();
    });
</script>

{#if widgetMode}
    <BlueprintWidget />
{:else}
    <div class="bg-bg-primary flex h-screen flex-col">
        <HeaderBar onabout={() => (showAbout = true)} />
        <main class="flex-1 overflow-hidden">
            {#if activeTab === 'editor'}
                <ThemeEditor />
            {:else if activeTab === 'wallhaven'}
                <WallhavenBrowser />
            {:else if activeTab === 'local'}
                <LocalBrowser />
            {:else if activeTab === 'favorites'}
                <FavoritesView />
            {:else if activeTab === 'blueprints'}
                <BlueprintsView />
            {:else if activeTab === 'system'}
                <div class="h-full overflow-y-auto p-3">
                    <OmarchyThemes />
                </div>
            {/if}
        </main>
        <ActionBar />
        <Toast />
        <ColorPickerDialog />
        <AboutDialog open={showAbout} onclose={() => (showAbout = false)} />
        <KeymapDialog open={showKeymap} onclose={() => (showKeymap = false)} />
    </div>
{/if}
