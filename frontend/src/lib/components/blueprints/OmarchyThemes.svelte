<script lang="ts">
    import {onMount} from 'svelte';
    import {
        setPalette,
        setExtendedColors,
        setNativeColors,
        setWallpaperPath,
        setAdditionalImages,
        setAppOverrides,
        setLightMode,
    } from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
    import {
        getCachedThumbnail,
        loadThumbnail,
    } from '$lib/stores/imagecache.svelte';
    import type {omarchy} from '../../../../wailsjs/go/models';
    import EmptyState from '$lib/components/shared/EmptyState.svelte';
    import LoadingState from '$lib/components/shared/LoadingState.svelte';
    import ViewHeader from '$lib/components/shared/ViewHeader.svelte';
    import CardSizeToggle from '$lib/components/shared/CardSizeToggle.svelte';
    import {getCardSize, CARD_MIN_WIDTH} from '$lib/stores/cardsize.svelte';
    import {
        getOmarchyCapabilities,
        refreshOmarchyCapabilities,
    } from '$lib/stores/omarchy.svelte';

    type Theme = omarchy.Theme;

    let themes = $state<Theme[]>([]);
    let isLoading = $state(true);
    let applyingName = $state('');
    let capabilities = $derived(getOmarchyCapabilities());

    onMount(() => {
        loadThemes();
    });

    async function loadThemes() {
        isLoading = true;
        try {
            const {LoadOmarchyThemes} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await LoadOmarchyThemes();
            themes = Array.isArray(result) ? result : [];
            // Load wallpaper previews into global cache
            for (const theme of themes) {
                const preview = theme.preview || theme.wallpapers?.[0];
                if (preview) {
                    loadThumbnail(preview);
                }
            }
        } catch {
            themes = [];
        } finally {
            isLoading = false;
        }
    }

    function loadThemeIntoState(theme: Theme): boolean {
        if (theme.colors?.length < 16) return false;
        setPalette(theme.colors);
        setExtendedColors(theme.extendedColors ?? {});
        setNativeColors(theme.nativeColors ?? {});
        if (theme.mode) setLightMode(theme.mode === 'light');
        setWallpaperPath(theme.wallpapers?.[0] ?? '');
        setAdditionalImages(theme.wallpapers?.slice(1) ?? []);
        setAppOverrides({});
        return true;
    }

    function handleEdit(theme: Theme) {
        if (loadThemeIntoState(theme)) {
            setActiveTab('editor');
            showToast(`Loaded theme: ${theme.name}`);
        }
    }

    async function handleApply(theme: Theme) {
        if (applyingName || !theme.canApply) return;
        applyingName = theme.name;
        try {
            const {ApplyOmarchyThemeByName} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ApplyOmarchyThemeByName(theme.name);
            await refreshOmarchyCapabilities();
            await loadThemes();
            showToast(`Applied theme: ${theme.name}`);
        } catch (error: unknown) {
            const message =
                typeof error === 'string'
                    ? error
                    : error instanceof Error
                      ? error.message
                      : 'Failed to apply theme';
            showToast(message);
        } finally {
            applyingName = '';
        }
    }
</script>

<div class="flex h-full flex-col">
    <ViewHeader>
        <span
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
            >Omarchy Themes</span
        >
        {#if capabilities.version}
            <span class="text-fg-dimmed text-[10px]">
                {capabilities.version}
            </span>
        {/if}
        <div class="ml-auto flex items-center gap-2">
            <CardSizeToggle />
            {#if !isLoading && themes.length > 0}
                <span class="text-fg-dimmed text-[10px]">{themes.length}</span>
            {/if}
        </div>
    </ViewHeader>

    <div class="flex-1 overflow-y-auto p-3">
        {#if isLoading}
            <LoadingState message="Loading system themes…" />
        {:else if themes.length === 0}
            <EmptyState
                title="No Omarchy themes found"
                body="Create a theme in the editor or install one with Omarchy."
            >
                {#snippet icon()}
                    <svg
                        class="h-12 w-12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path
                            d="M18.37 2.63a2.12 2.12 0 0 1 3 3L14 13l-4 1 1-4z"
                        ></path>
                        <path
                            d="M9 14.5A3.5 3.5 0 0 0 5.5 18c-1.2 0-2.5.7-2.5 2 2 0 4.5-1 5.5-3.5"
                        ></path>
                    </svg>
                {/snippet}
            </EmptyState>
        {:else}
            <div
                class="grid gap-3"
                style:grid-template-columns="repeat(auto-fill, minmax({CARD_MIN_WIDTH[
                    getCardSize()
                ]}px, 1fr))"
            >
                {#each themes as theme, i (theme.name + '_' + i)}
                    {@const preview = theme.preview || theme.wallpapers?.[0]}
                    <div
                        class="bg-bg-surface border-border group overflow-hidden border"
                    >
                        <!-- Preview image -->
                        <div
                            class="bg-bg-primary flex aspect-video items-center justify-center overflow-hidden"
                        >
                            {#if preview && getCachedThumbnail(preview)}
                                <img
                                    src={getCachedThumbnail(preview)}
                                    alt={theme.name}
                                    class="h-full w-full object-cover"
                                />
                            {:else}
                                <!-- Color strip fallback -->
                                <div
                                    class="flex h-full w-full flex-col justify-end"
                                >
                                    <div class="flex h-full">
                                        {#each (theme.colors || []).slice(0, 8) as c}
                                            <div
                                                class="flex-1"
                                                style:background-color={c}
                                            ></div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                        </div>

                        <!-- Color palette strip -->
                        <div class="flex h-3">
                            {#each (theme.colors || []).slice(0, 16) as c}
                                <div
                                    class="flex-1"
                                    style:background-color={c}
                                ></div>
                            {/each}
                        </div>

                        <!-- Info -->
                        <div class="flex items-center justify-between p-2">
                            <div>
                                <span
                                    class="text-fg-primary text-[11px] font-medium"
                                    >{theme.name}</span
                                >
                                {#if theme.isCurrentTheme}
                                    <span class="text-accent ml-1 text-[10px]"
                                        >current</span
                                    >
                                {/if}
                                {#if theme.isOverlay}
                                    <span
                                        class="text-fg-dimmed ml-1 text-[10px]"
                                        >overlay</span
                                    >
                                {/if}
                                {#if theme.isAetherGenerated}
                                    <span
                                        class="text-fg-dimmed ml-1 text-[10px]"
                                        >aether</span
                                    >
                                {/if}
                            </div>
                            <div
                                class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                            >
                                <button
                                    class="text-fg-dimmed border-border hover:bg-bg-elevated border px-2 py-1 text-[10px] transition-colors"
                                    onclick={() => handleEdit(theme)}
                                    >Edit</button
                                >
                                <button
                                    class="bg-accent hover:bg-accent-hover text-accent-fg disabled:bg-bg-elevated disabled:text-fg-dimmed px-2 py-1 text-[10px] font-medium transition-colors"
                                    onclick={() => handleApply(theme)}
                                    disabled={!!applyingName || !theme.canApply}
                                    title={theme.canApply
                                        ? 'Apply with Omarchy'
                                        : 'This theme is available for editing only'}
                                    >{applyingName === theme.name
                                        ? 'Applying...'
                                        : 'Apply'}</button
                                >
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
