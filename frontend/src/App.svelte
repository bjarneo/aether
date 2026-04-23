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
    import WallpaperSlider from '$lib/components/slider/WallpaperSlider.svelte';
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
        getEyedropperActive,
        setEyedropperActive,
        getCommandPaletteOpen,
        openCommandPalette,
        closeCommandPalette,
        getKeymapOpen,
        setKeymapOpen,
        toggleKeymap,
    } from '$lib/stores/ui.svelte';
    import {
        setWallpaperPath,
        setPalette,
        setAdjustments,
        setColor,
        setExtendedColor,
        setAppOverride,
        setLightMode,
        setExtractionMode,
        getThemeSnapshot,
    } from '$lib/stores/theme.svelte';
    import {debounce} from '$lib/utils/debounce';
    import {pushState} from '$lib/stores/history.svelte';
    import {
        applyTheme,
        undoAction,
        redoAction,
    } from '$lib/actions/themeActions';
    import {
        zoomIn,
        zoomOut,
        resetZoom,
        setZoom,
        getZoom,
    } from '$lib/utils/zoom';
    import Toast from '$lib/components/shared/Toast.svelte';
    import AboutStrip from '$lib/components/layout/AboutStrip.svelte';
    import KeymapDialog from '$lib/components/shared/KeymapDialog.svelte';
    import CommandPalette from '$lib/components/shared/CommandPalette.svelte';
    import {initKeyboardShortcuts, registerShortcut} from '$lib/utils/keyboard';
    import {hexToRgb} from '$lib/utils/color';
    import {buildCommands} from '$lib/commands/commands.svelte';
    import type {main} from '../wailsjs/go/models';

    let activeTab = $derived(getActiveTab());
    let commands = $derived(buildCommands());
    let widgetMode = $state(false);
    let sliderWidget = $state(false);
    let themesSlider = $state(false);

    // Mirror editor state into Go (debounced) so `aether status` and other IPC
    // readers reflect live edits without waiting for an Apply. 300ms covers
    // slider drags; the first sync on mount posts the initial snapshot.
    const syncStateToBackend = debounce((snapshot: main.SyncStateRequest) => {
        import('../wailsjs/go/main/App')
            .then(({SyncState}) => SyncState(snapshot))
            .catch(() => {});
    }, 300);

    $effect(() => {
        syncStateToBackend(
            getThemeSnapshot() as unknown as main.SyncStateRequest
        );
    });

    onMount(async () => {
        try {
            const {IsWidgetMode, IsSliderWidget, IsThemesSlider} = await import(
                '../wailsjs/go/main/App'
            );
            widgetMode = await IsWidgetMode();
            sliderWidget = await IsSliderWidget();
            themesSlider = await IsThemesSlider();
        } catch {}

        // Show window now that the DOM is ready (started hidden to avoid white flash)
        if (!sliderWidget && !themesSlider) {
            try {
                const {WindowShow} = await import('../wailsjs/runtime/runtime');
                WindowShow();
            } catch {}
        }

        if (widgetMode || sliderWidget || themesSlider) return;

        // Focus a specific tab if requested via --tab flag
        try {
            const {GetFocusTab} = await import('../wailsjs/go/main/App');
            const tab = await GetFocusTab();
            if (tab) setActiveTab(tab as any);
        } catch {}

        // Overwrite module-load DEFAULT_PALETTE with backend defaults
        // before any user interaction so history starts clean.
        try {
            const {GetInitialState} = await import('../wailsjs/go/main/App');
            const s = await GetInitialState();
            if (s?.palette?.length >= 16) {
                setPalette(s.palette, true /* skipHistory */);
            }
            if (s?.wallpaperPath) {
                setWallpaperPath(s.wallpaperPath);
            }
        } catch (e) {
            console.warn('GetInitialState failed:', e);
        }

        initKeyboardShortcuts();

        registerShortcut('ctrl+z', undoAction);
        registerShortcut('ctrl+shift+z', redoAction);
        registerShortcut('ctrl+enter', applyTheme);

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

        setZoom(getZoom());
        registerShortcut('ctrl+shift++', zoomIn);
        registerShortcut('ctrl++', zoomIn);
        registerShortcut('ctrl+-', zoomOut);
        registerShortcut('ctrl+0', resetZoom);

        // Ctrl+K - Show keymap
        registerShortcut('ctrl+k', () => {
            toggleKeymap();
        });

        // Ctrl+P - Command palette
        registerShortcut('ctrl+p', () => {
            if (getCommandPaletteOpen()) closeCommandPalette();
            else openCommandPalette();
        });

        registerShortcut('escape', () => {
            if (getCommandPaletteOpen()) closeCommandPalette();
            else if (getEyedropperActive()) setEyedropperActive(false);
            else if (getColorPickerOpen()) closeColorPicker();
            else if (getKeymapOpen()) setKeymapOpen(false);
        });

        // Listen for events from Go
        (async () => {
            try {
                const {EventsOn, WindowSetBackgroundColour} = await import(
                    '../wailsjs/runtime/runtime'
                );

                const applyThemeColors = (colors: Record<string, string>) => {
                    const root = document.documentElement;
                    for (const [name, value] of Object.entries(colors)) {
                        root.style.setProperty(`--aether-${name}`, value);
                    }
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
                        const rgb = hexToRgb(colors.background);
                        WindowSetBackgroundColour(rgb.r, rgb.g, rgb.b, 255);
                    }
                    if (colors.foreground) {
                        root.style.setProperty(
                            '--color-fg-primary',
                            colors.foreground
                        );
                        document.body.style.color = colors.foreground;
                    }
                    if (colors.blue) {
                        root.style.setProperty('--color-accent', colors.blue);
                    }
                    if (colors.red) {
                        root.style.setProperty(
                            '--color-destructive',
                            colors.red
                        );
                    }
                    if (colors.green) {
                        root.style.setProperty('--color-success', colors.green);
                    }
                    if (colors.yellow) {
                        root.style.setProperty(
                            '--color-warning',
                            colors.yellow
                        );
                    }
                    // Read synchronously by index.html at first paint to
                    // avoid a flash before the Wails bridge is ready.
                    try {
                        localStorage.setItem(
                            'aether-theme-colors',
                            JSON.stringify(colors)
                        );
                    } catch {}
                };

                EventsOn('theme-colors-changed', applyThemeColors);

                // Pull before subscribing-is-too-late: EventsOn attaches
                // after the watcher's startup emit has already fired.
                try {
                    const {GetThemeColors} = await import(
                        '../wailsjs/go/main/App'
                    );
                    const colors = await GetThemeColors();
                    if (colors && Object.keys(colors).length > 0) {
                        applyThemeColors(colors);
                    }
                } catch {}

                // Listen for IPC remote control state changes
                EventsOn(
                    'ipc-state-changed',
                    (state: {
                        palette?: string[];
                        lightMode?: boolean;
                        mode?: string;
                        wallpaper?: string;
                        adjustments?: import('$lib/types/theme').Adjustments;
                    }) => {
                        if (state.palette && state.palette.length >= 16) {
                            setPalette(state.palette);
                        }
                        if (state.lightMode !== undefined) {
                            setLightMode(state.lightMode);
                        }
                        if (state.mode) {
                            setExtractionMode(state.mode);
                        }
                        if (state.wallpaper) {
                            setWallpaperPath(state.wallpaper);
                        }
                        if (state.adjustments) {
                            setAdjustments(state.adjustments);
                        }
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
{:else if sliderWidget}
    <WallpaperSlider
        mode="wallpapers"
        onclose={async () => {
            const {Quit} = await import('../wailsjs/runtime/runtime');
            Quit();
        }}
    />
{:else if themesSlider}
    <WallpaperSlider
        mode="themes"
        onclose={async () => {
            const {Quit} = await import('../wailsjs/runtime/runtime');
            Quit();
        }}
    />
{:else}
    <div class="bg-bg-primary flex h-screen flex-col">
        <HeaderBar />
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
        <AboutStrip />
        <Toast />
        <KeymapDialog
            open={getKeymapOpen()}
            onclose={() => setKeymapOpen(false)}
        />
        <CommandPalette
            open={getCommandPaletteOpen()}
            {commands}
            onclose={closeCommandPalette}
        />
    </div>
{/if}
