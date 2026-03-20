<script lang="ts">
    import WallhavenFilters from './WallhavenFilters.svelte';
    import WallpaperGrid from './WallpaperGrid.svelte';
    import Pagination from './Pagination.svelte';
    import {
        getResults,
        getIsSearching,
        search,
        getTotalPages,
        getTotalResults,
        getPage,
        setPage,
    } from '$lib/stores/wallhaven.svelte';

    // Auto-search on mount if no results yet
    $effect(() => {
        if (getResults().length === 0 && !getIsSearching()) {
            search();
        }
    });
</script>

<div class="flex h-full flex-col">
    <WallhavenFilters />

    <div class="flex-1 overflow-y-auto p-3">
        {#if getIsSearching()}
            <div class="flex h-32 items-center justify-center">
                <span class="text-fg-dimmed text-sm"
                    >Searching wallhaven...</span
                >
            </div>
        {:else if getResults().length === 0}
            <div class="flex h-32 items-center justify-center">
                <span class="text-fg-dimmed text-sm">No results found</span>
            </div>
        {:else}
            <WallpaperGrid wallpapers={getResults()} />
        {/if}
    </div>

    {#if getTotalPages() > 1}
        <Pagination
            currentPage={getPage()}
            totalPages={getTotalPages()}
            onPageChange={p => {
                setPage(p);
                search();
            }}
        />
    {/if}
</div>
