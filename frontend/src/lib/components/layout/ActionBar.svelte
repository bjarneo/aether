<script lang="ts">
    import {
        getIsApplying,
        setPalette,
        getPalette,
        getWallpaperPath,
        setWallpaperPath,
        getLightMode,
        setLightMode,
        getAdditionalImages,
        getExtendedColors,
        getAppOverrides,
        getAdjustments,
        setAdjustments,
        setAdjustedExtendedColors,
        isDirty,
        reset as resetTheme,
    } from '$lib/stores/theme.svelte';
    import {
        getCanUndo,
        getCanRedo,
        undo,
        redo,
        pushRedo,
        pushUndo,
    } from '$lib/stores/history.svelte';
    import {getSettings} from '$lib/stores/settings.svelte';
    import {
        getActiveTab,
        setActiveTab,
        showToast,
        getLiveApply,
        setLiveApply,
        getLivePending,
        getTargetsVisible,
        toggleTargetsVisible,
    } from '$lib/stores/ui.svelte';
    import {getApiKey, getTotalResults} from '$lib/stores/wallhaven.svelte';
    import {applyTheme} from '$lib/actions/themeActions';
    import SaveDialog from '$lib/components/blueprints/SaveDialog.svelte';
    import ConfirmDialog from '$lib/components/shared/ConfirmDialog.svelte';

    let showImportMenu = $state(false);
    let showExportDialog = $state(false);
    let showSaveDialog = $state(false);
    let confirmKind = $state<'revert' | 'reset' | null>(null);
    let exportName = $state('');
    let installToOmarchy = $state(false);
    let isOmarchy = $state(false);
    let exportNameInput = $state<HTMLInputElement | null>(null);

    $effect(() => {
        if (showExportDialog) exportNameInput?.focus();
    });

    let activeTab = $derived(getActiveTab());
    let wallpaperSelected = $derived(getWallpaperPath() !== '');
    let apiKeySet = $derived(getApiKey() !== '');
    let totalResults = $derived(getTotalResults());

    const exportAppGroups = [
        {
            label: 'Editor themes',
            apps: [
                {key: 'vscode', name: 'VS Code'},
                {key: 'zed', name: 'Zed'},
                {key: 'neovim', name: 'Neovim'},
            ],
        },
        {
            label: 'Terminals',
            apps: [
                {key: 'alacritty', name: 'Alacritty'},
                {key: 'ghostty', name: 'Ghostty'},
                {key: 'kitty', name: 'Kitty'},
                {key: 'warp', name: 'Warp'},
            ],
        },
        {
            label: 'Desktop',
            apps: [
                {key: 'gtk', name: 'GTK'},
                {key: 'hyprland', name: 'Hyprland'},
                {key: 'hyprlock', name: 'Hyprlock'},
                {key: 'icons', name: 'Icons'},
                {key: 'mako', name: 'Mako'},
                {key: 'swayosd', name: 'SwayOSD'},
                {key: 'walker', name: 'Walker'},
                {key: 'waybar', name: 'Waybar'},
                {key: 'wofi', name: 'Wofi'},
            ],
        },
        {
            label: 'Apps',
            apps: [
                {key: 'btop', name: 'Btop'},
                {key: 'chromium', name: 'Chromium'},
                {key: 'vencord', name: 'Vencord'},
                {key: 'colors', name: 'Colors (.toml)'},
            ],
        },
    ] as const;

    function createDefaultExportApps(): Record<string, boolean> {
        const apps: Record<string, boolean> = {};
        for (const group of exportAppGroups) {
            for (const app of group.apps) {
                apps[app.key] = true;
            }
        }
        return apps;
    }

    let exportApps = $state<Record<string, boolean>>(createDefaultExportApps());

    let undoEnabled = $derived(getCanUndo());
    let redoEnabled = $derived(getCanRedo());
    let liveApply = $derived(getLiveApply());
    let livePending = $derived(getLivePending());
    let applying = $derived(getIsApplying());
    let dirty = $derived(isDirty());
    let targetsVisible = $derived(getTargetsVisible());
    let overrideCount = $derived(
        Object.values(getAppOverrides()).reduce(
            (sum, o) => sum + Object.keys(o).length,
            0
        )
    );

    // --- Editor actions ---

    const handleApply = applyTheme;

    function handleUndo() {
        const snapshot = undo();
        if (snapshot) {
            pushRedo(getPalette(), getExtendedColors(), getAdjustments());
            setPalette(snapshot.palette, true);
            setAdjustedExtendedColors(snapshot.extendedColors);
            setAdjustments(snapshot.adjustments);
        }
    }

    function handleRedo() {
        const snapshot = redo();
        if (snapshot) {
            pushUndo(getPalette(), getExtendedColors(), getAdjustments());
            setPalette(snapshot.palette, true);
            setAdjustedExtendedColors(snapshot.extendedColors);
            setAdjustments(snapshot.adjustments);
        }
    }

    async function handleClear() {
        try {
            const {ClearTheme} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ClearTheme();
            showToast('Reverted to system theme');
        } catch {
            showToast('Couldn’t revert — see logs for details');
        }
    }

    async function handleReset() {
        try {
            const {ResetState} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ResetState();
            resetTheme();
            showToast('Editor reset');
        } catch {
            resetTheme();
            showToast('Editor reset');
        }
    }

    async function handleExport() {
        if (!exportName.trim()) return;
        try {
            const {ExportTheme} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const includedApps = Object.entries(exportApps)
                .filter(([, enabled]) => enabled)
                .map(([key]) => key);
            const path = await ExportTheme({
                name: exportName.trim(),
                includedApps,
                palette: getPalette(),
                wallpaperPath: getWallpaperPath(),
                lightMode: getLightMode(),
                additionalImages: getAdditionalImages(),
                extendedColors: getExtendedColors(),
                installToOmarchy,
                appOverrides: getAppOverrides(),
            });
            showToast(
                installToOmarchy
                    ? `Exported and installed as Omarchy theme`
                    : `Exported to ${path}`
            );
            showExportDialog = false;
            exportName = '';
            installToOmarchy = false;
        } catch (e: any) {
            showToast(e?.message || 'Export failed');
        }
    }

    async function handleImport(fileType: string) {
        showImportMenu = false;
        try {
            const {ImportFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ImportFileDialog(fileType);
            console.log('Import result:', result);
            if (result?.colors?.length >= 16) {
                setPalette(result.colors);
                if (result.wallpaperPath) {
                    setWallpaperPath(result.wallpaperPath);
                }
                if (result.lightMode !== undefined) {
                    setLightMode(result.lightMode);
                }
                showToast(`Imported: ${result.name || fileType}`);
            } else {
                showToast('Import returned no colors');
            }
        } catch (e: any) {
            console.error('Import error:', e);
            if (e?.message?.includes('cancelled')) return;
            showToast('Import failed: ' + (e?.message || JSON.stringify(e)));
        }
    }
</script>

{#snippet goToEditor()}
    {#if wallpaperSelected}
        <button
            class="bg-accent text-bg-primary hover:bg-accent-hover px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
            onclick={() => setActiveTab('editor')}>Go to Editor</button
        >
    {/if}
{/snippet}

<footer
    class="bg-bg-secondary border-border flex h-10 shrink-0 items-center gap-3 border-t px-3"
>
    <div class="text-fg-dimmed flex shrink-0 items-center gap-2 text-[10px]">
        <span title="Aether version">v{__APP_VERSION__}</span>
        {#if overrideCount > 0}
            <span class="text-accent" title="Active per-app template overrides">
                {overrideCount} override{overrideCount === 1 ? '' : 's'}
            </span>
        {/if}
        {#if activeTab === 'editor'}
            <button
                class="hover:text-fg-secondary transition-colors {targetsVisible
                    ? 'text-fg-secondary'
                    : ''}"
                onclick={toggleTargetsVisible}
                title={targetsVisible
                    ? 'Hide the Targets strip'
                    : 'Show the Targets strip'}
                aria-pressed={targetsVisible}
            >
                Targets
            </button>
        {/if}
    </div>

    <div class="flex min-w-0 flex-1 items-center justify-between gap-1">
        {#if activeTab === 'editor'}
            <div class="flex items-center gap-1">
                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={async () => {
                        showExportDialog = true;
                        try {
                            const {IsOmarchyInstalled} = await import(
                                '../../../../wailsjs/go/main/App'
                            );
                            isOmarchy = await IsOmarchyInstalled();
                        } catch {
                            isOmarchy = false;
                        }
                    }}>Export</button
                >

                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={() => (showSaveDialog = true)}>Save</button
                >

                <div class="relative">
                    <button
                        class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                        onclick={() => (showImportMenu = !showImportMenu)}
                        >Import</button
                    >

                    {#if showImportMenu}
                        <!-- svelte-ignore a11y_no_static_element_interactions -->
                        <div
                            class="fixed inset-0 z-30"
                            onclick={() => (showImportMenu = false)}
                        ></div>
                        <div
                            class="bg-bg-secondary border-border absolute bottom-full left-0 z-40 mb-1 min-w-[140px] border shadow-lg"
                        >
                            <button
                                class="text-fg-secondary hover:text-fg-primary hover:bg-bg-hover w-full px-3 py-1.5 text-left text-[11px] transition-colors"
                                onclick={() => handleImport('base16')}
                                >Base16 (.yaml)</button
                            >
                            <button
                                class="text-fg-secondary hover:text-fg-primary hover:bg-bg-hover w-full px-3 py-1.5 text-left text-[11px] transition-colors"
                                onclick={() => handleImport('toml')}
                                >Colors (.toml)</button
                            >
                            <button
                                class="text-fg-secondary hover:text-fg-primary hover:bg-bg-hover w-full px-3 py-1.5 text-left text-[11px] transition-colors"
                                onclick={() => handleImport('blueprint')}
                                >Blueprint (.json)</button
                            >
                        </div>
                    {/if}
                </div>

                <div class="bg-border mx-1 h-4 w-px"></div>

                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100 disabled:cursor-default disabled:opacity-25"
                    onclick={handleUndo}
                    disabled={!undoEnabled}
                    title="Undo (Ctrl+Z)">Undo</button
                >
                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100 disabled:cursor-default disabled:opacity-25"
                    onclick={handleRedo}
                    disabled={!redoEnabled}
                    title="Redo (Ctrl+Shift+Z)">Redo</button
                >
            </div>

            <div class="flex items-center gap-1">
                <button
                    class="text-destructive/60 hover:text-destructive hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={() => (confirmKind = 'revert')}
                    title="Revert system to its default theme">Revert</button
                >
                <button
                    class="text-destructive/60 hover:text-destructive hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={() => (confirmKind = 'reset')}
                    title="Reset the editor's in-memory state">Reset</button
                >

                <div class="bg-border mx-1 h-4 w-px"></div>

                <button
                    type="button"
                    onclick={() => setLiveApply(!liveApply)}
                    class="flex items-center gap-1.5 border px-2 py-0.5 text-[11px] transition-colors duration-100 {liveApply
                        ? 'bg-accent-muted border-accent text-accent'
                        : 'border-border text-fg-dimmed hover:text-fg-secondary hover:border-border-focus'}"
                    role="switch"
                    aria-checked={liveApply}
                    title={!liveApply
                        ? 'Auto-apply theme on every edit (debounced)'
                        : livePending
                          ? 'Live preview — syncing changes…'
                          : 'Live preview on — every edit auto-applies (Ctrl+Z to revert)'}
                >
                    <span class="relative inline-flex h-1.5 w-1.5">
                        {#if liveApply && livePending}
                            <span
                                class="bg-accent absolute inline-flex h-full w-full animate-ping opacity-70"
                            ></span>
                        {/if}
                        <span
                            class="relative inline-flex h-1.5 w-1.5 {liveApply
                                ? 'bg-accent'
                                : 'bg-fg-dimmed/40'}"
                        ></span>
                    </span>
                    {liveApply && livePending ? 'Syncing' : 'Live'}
                </button>

                <button
                    class="bg-accent text-bg-primary hover:bg-accent-hover relative inline-flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium transition-colors duration-100 disabled:opacity-50"
                    onclick={handleApply}
                    disabled={applying}
                    title={dirty
                        ? 'Unsaved changes — click to apply (Ctrl+Enter)'
                        : 'Apply theme to system (Ctrl+Enter)'}
                >
                    <span>{applying ? 'Applying...' : 'Apply Theme'}</span>
                    {#if !applying}
                        <kbd
                            class="border-bg-primary/30 bg-bg-primary/15 inline-flex items-center border px-1 font-mono text-[9px] leading-[1.4] opacity-90"
                            aria-hidden="true">Ctrl+↵</kbd
                        >
                    {/if}
                    {#if dirty && !applying}
                        <span
                            class="bg-warning absolute -right-1 -top-1 h-2 w-2 ring-2 ring-[var(--color-bg-secondary)]"
                            aria-label="Unsaved changes"
                        ></span>
                    {/if}
                </button>
            </div>
        {:else if activeTab === 'wallhaven'}
            <div class="flex items-center gap-2">
                {#if apiKeySet}
                    <span class="text-success text-[11px]">API key set</span>
                {:else}
                    <span class="text-fg-dimmed text-[11px]"
                        >No API key (set in filters)</span
                    >
                {/if}
                {#if totalResults > 0}
                    <div class="bg-border mx-1 h-4 w-px"></div>
                    <span class="text-fg-dimmed text-[11px]"
                        >{totalResults.toLocaleString()} results</span
                    >
                {/if}
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {:else if activeTab === 'local'}
            <div class="flex items-center gap-1">
                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={async () => {
                        try {
                            const {ScanLocalWallpapers} = await import(
                                '../../../../wailsjs/go/main/App'
                            );
                            await ScanLocalWallpapers();
                            showToast('Wallpapers rescanned');
                            // Force LocalBrowser to remount so it re-reads the file list
                            setActiveTab('editor');
                            setTimeout(() => setActiveTab('local'), 0);
                        } catch {
                            showToast('Failed to rescan');
                        }
                    }}>Rescan</button
                >
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {:else if activeTab === 'favorites'}
            <div class="flex items-center gap-1">
                <span class="text-fg-dimmed text-[11px]"
                    >Favorited wallpapers</span
                >
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {:else if activeTab === 'blueprints'}
            <div class="flex items-center gap-1">
                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={() => (showSaveDialog = true)}>Save Current</button
                >
                <button
                    class="text-fg-dimmed hover:text-fg-secondary hover:bg-bg-hover px-2 py-1 text-[11px] transition-colors duration-100"
                    onclick={() => handleImport('blueprint')}
                    >Import Blueprint</button
                >
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {:else if activeTab === 'system'}
            <div class="flex items-center gap-1">
                <span class="text-fg-dimmed text-[11px]">System themes</span>
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {:else if activeTab === 'about'}
            <div class="flex items-center gap-1">
                <span class="text-fg-dimmed text-[11px]">About</span>
            </div>
            <div class="flex items-center gap-1">
                {@render goToEditor()}
            </div>
        {/if}
    </div>
</footer>

<!-- Export Dialog -->
{#if showExportDialog}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
        onclick={e => {
            if (e.target === e.currentTarget) showExportDialog = false;
        }}
    >
        <div
            class="bg-bg-secondary border-border max-h-[80vh] w-80 overflow-y-auto border p-4 shadow-xl"
            onkeydown={e => {
                if (e.key === 'Enter') handleExport();
                if (e.key === 'Escape') showExportDialog = false;
            }}
        >
            <h3 class="text-fg-primary mb-3 text-[12px] font-medium">
                Export Theme
            </h3>
            <input
                bind:this={exportNameInput}
                type="text"
                class="bg-bg-surface border-border text-fg-primary focus:border-border-focus mb-3 w-full border px-2 py-1.5 text-[11px] outline-none"
                placeholder="Theme name..."
                bind:value={exportName}
                aria-label="Theme name"
            />
            <div class="mb-3 flex flex-col gap-2.5">
                {#each exportAppGroups as group}
                    <div>
                        <span
                            class="text-fg-dimmed text-[10px] uppercase tracking-wide"
                            >{group.label}</span
                        >
                        <div class="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                            {#each group.apps as app}
                                <label
                                    class="text-fg-secondary flex cursor-pointer items-center gap-1.5 text-[11px]"
                                >
                                    <input
                                        type="checkbox"
                                        bind:checked={exportApps[app.key]}
                                        class="accent-accent"
                                    />
                                    {app.name}
                                </label>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
            {#if isOmarchy}
                <label
                    class="text-fg-secondary mb-3 flex cursor-pointer items-center gap-1.5 text-[11px]"
                >
                    <input
                        type="checkbox"
                        bind:checked={installToOmarchy}
                        class="accent-accent"
                    />
                    Install as Omarchy theme
                </label>
            {/if}
            <div class="flex justify-end gap-2">
                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-3 py-1 text-[11px]"
                    onclick={() => (showExportDialog = false)}>Cancel</button
                >
                <button
                    class="bg-accent text-bg-primary hover:bg-accent-hover px-3 py-1 text-[11px] font-medium disabled:opacity-50"
                    onclick={handleExport}
                    disabled={!exportName.trim()}>Export</button
                >
            </div>
        </div>
    </div>
{/if}

<!-- Save Blueprint Dialog -->
{#if showSaveDialog}
    <SaveDialog
        onclose={() => (showSaveDialog = false)}
        onsave={() => (showSaveDialog = false)}
    />
{/if}

<ConfirmDialog
    open={confirmKind === 'revert'}
    title="Revert system theme?"
    body="This will roll your desktop back to its default theme. Your editor state stays intact, so you can re-apply afterwards."
    confirmLabel="Revert"
    danger={true}
    onconfirm={() => {
        confirmKind = null;
        handleClear();
    }}
    oncancel={() => (confirmKind = null)}
/>
<ConfirmDialog
    open={confirmKind === 'reset'}
    title="Reset editor?"
    body="Clears the current palette, wallpaper, adjustments, and overrides from the editor. This does not change anything on disk."
    confirmLabel="Reset"
    danger={true}
    onconfirm={() => {
        confirmKind = null;
        handleReset();
    }}
    oncancel={() => (confirmKind = null)}
/>
