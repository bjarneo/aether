<script lang="ts">
    import {
        getCachedThumbnail,
        loadThumbnail,
    } from '$lib/stores/imagecache.svelte';
    import type {Blueprint} from '$lib/types/theme';

    let {
        blueprint,
        onload,
        ondelete,
    }: {
        blueprint: Blueprint;
        onload: () => void;
        ondelete: () => void;
    } = $props();

    let confirmingDelete = $state(false);

    let wallpaperPath = $derived(blueprint.palette?.wallpaper ?? '');

    $effect(() => {
        if (wallpaperPath) loadThumbnail(wallpaperPath);
    });

    function formatDate(ts: number): string {
        if (!ts) return '';
        return new Date(ts).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    }
</script>

<div class="bg-bg-surface border-border group overflow-hidden border">
    <!-- Wallpaper preview -->
    <div
        class="bg-bg-primary flex aspect-video items-center justify-center overflow-hidden"
    >
        {#if wallpaperPath && getCachedThumbnail(wallpaperPath)}
            <img
                src={getCachedThumbnail(wallpaperPath)}
                alt={blueprint.name}
                class="h-full w-full object-cover"
            />
        {:else}
            <!-- Color strip fallback -->
            <div class="flex h-full w-full flex-col justify-end">
                <div class="flex h-full">
                    {#each (blueprint.palette?.colors || []).slice(0, 8) as color}
                        <div
                            class="flex-1"
                            style:background-color={color}
                        ></div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>

    <!-- Color palette strip -->
    <div class="flex h-3">
        {#each (blueprint.palette?.colors || []).slice(0, 16) as color}
            <div class="flex-1" style:background-color={color}></div>
        {/each}
    </div>

    <!-- Info + actions -->
    <div class="p-2">
        <div class="mb-1 flex items-center justify-between">
            <span class="text-fg-primary truncate text-[11px] font-medium"
                >{blueprint.name}</span
            >
            <span class="text-fg-dimmed text-[10px]"
                >{formatDate(blueprint.timestamp)}</span
            >
        </div>
        {#if confirmingDelete}
            <div class="mt-1 flex items-center gap-1.5">
                <span class="text-fg-dimmed flex-1 text-[10px]"
                    >Delete this theme?</span
                >
                <button
                    class="text-fg-dimmed hover:text-fg-secondary px-2 py-1 text-[10px]"
                    onclick={() => (confirmingDelete = false)}>No</button
                >
                <button
                    class="text-destructive border-border hover:bg-bg-elevated border px-2 py-1 text-[10px] font-medium"
                    onclick={ondelete}>Yes</button
                >
            </div>
        {:else}
            <div
                class="mt-1 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100"
            >
                <button
                    class="bg-accent hover:bg-accent-hover flex-1 px-2 py-1 text-[10px] font-medium text-[#111116]"
                    onclick={onload}>Use</button
                >
                <button
                    class="text-destructive border-border hover:bg-bg-elevated border px-2 py-1 text-[10px]"
                    onclick={() => (confirmingDelete = true)}>Delete</button
                >
            </div>
        {/if}
    </div>
</div>
