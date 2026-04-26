<script lang="ts">
    import {onMount} from 'svelte';
    import {setPalette, setWallpaperPath} from '$lib/stores/theme.svelte';
    import {setActiveTab, showToast} from '$lib/stores/ui.svelte';
    import {
        getCachedThumbnail,
        loadThumbnail,
    } from '$lib/stores/imagecache.svelte';
    import type {omarchy} from '../../../../wailsjs/go/models';

    type Theme = omarchy.Theme;

    let themes = $state<Theme[]>([]);
    let isLoading = $state(true);

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
                if (theme.wallpapers?.length > 0) {
                    loadThumbnail(theme.wallpapers[0]);
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
        if (theme.wallpapers?.length > 0) {
            setWallpaperPath(theme.wallpapers[0]);
        }
        return true;
    }

    function handleEdit(theme: Theme) {
        if (loadThemeIntoState(theme)) {
            setActiveTab('editor');
            showToast(`Loaded theme: ${theme.name}`);
        }
    }

    async function handleApply(theme: Theme) {
        loadThemeIntoState(theme);
        try {
            const {ApplyOmarchyThemeByName} = await import(
                '../../../../wailsjs/go/main/App'
            );
            await ApplyOmarchyThemeByName(theme.name);
            showToast(`Applied theme: ${theme.name}`);
        } catch {
            showToast('Failed to apply theme');
        }
    }
</script>

{#if isLoading}
    <div
        class="text-fg-dimmed flex h-32 items-center justify-center text-[12px]"
    >
        Loading system themes...
    </div>
{:else if themes.length === 0}
    <div
        class="text-fg-dimmed flex h-32 items-center justify-center text-[12px]"
    >
        No system themes found
    </div>
{:else}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3">
        {#each themes as theme, i (theme.name + '_' + i)}
            <div
                class="bg-bg-surface border-border group overflow-hidden border"
            >
                <!-- Preview image -->
                <div
                    class="bg-bg-primary flex aspect-video items-center justify-center overflow-hidden"
                >
                    {#if theme.wallpapers?.length > 0 && getCachedThumbnail(theme.wallpapers[0])}
                        <img
                            src={getCachedThumbnail(theme.wallpapers[0])}
                            alt={theme.name}
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        <!-- Color strip fallback -->
                        <div class="flex h-full w-full flex-col justify-end">
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
                        <div class="flex-1" style:background-color={c}></div>
                    {/each}
                </div>

                <!-- Info -->
                <div class="flex items-center justify-between p-2">
                    <div>
                        <span class="text-fg-primary text-[11px] font-medium"
                            >{theme.name}</span
                        >
                        {#if theme.isCurrentTheme}
                            <span class="text-accent ml-1 text-[10px]"
                                >current</span
                            >
                        {/if}
                    </div>
                    <div
                        class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <button
                            class="text-fg-dimmed border-border hover:bg-bg-elevated border px-2 py-1 text-[10px]"
                            onclick={() => handleEdit(theme)}>Edit</button
                        >
                        <button
                            class="bg-accent hover:bg-accent-hover px-2 py-1 text-[10px] font-medium text-[#111116]"
                            onclick={() => handleApply(theme)}>Apply</button
                        >
                    </div>
                </div>
            </div>
        {/each}
    </div>
{/if}
