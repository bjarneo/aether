<script lang="ts">
    import WallhavenFilters from './WallhavenFilters.svelte';
    import WallpaperGrid from './WallpaperGrid.svelte';
    import {
        getResults,
        getIsSearching,
        getIsLoadingMore,
        getHasMore,
        search,
        loadMore,
    } from '$lib/stores/wallhaven.svelte';
    import {observeIntersection} from '$lib/utils/intersection';

    let scrollContainer = $state<HTMLDivElement | null>(null);
    let sentinel = $state<HTMLDivElement | null>(null);

    $effect(() => {
        if (getResults().length === 0 && !getIsSearching()) {
            search();
        }
    });

    // Re-observe on every results change so the sentinel fires again even if it
    // stays intersecting — IntersectionObserver only reports *transitions*, so
    // a sentinel that's permanently in-view (first page smaller than viewport)
    // would otherwise trigger only once. Re-observing pumps loadMore until the
    // viewport fills or hasMore becomes false.
    $effect(() => {
        if (!sentinel || !scrollContainer) return;
        getResults().length;
        return observeIntersection(
            sentinel,
            entry => {
                if (
                    entry.isIntersecting &&
                    getHasMore() &&
                    !getIsSearching() &&
                    !getIsLoadingMore()
                ) {
                    loadMore();
                }
            },
            {root: scrollContainer, rootMargin: '400px 0px'}
        );
    });
</script>

<div class="flex h-full flex-col">
    <WallhavenFilters />

    <div class="flex-1 overflow-y-auto p-3" bind:this={scrollContainer}>
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

            <div bind:this={sentinel} class="h-1 w-full"></div>

            {#if getIsLoadingMore()}
                <div class="flex h-12 items-center justify-center">
                    <span class="text-fg-dimmed text-xs">Loading more...</span>
                </div>
            {:else if !getHasMore()}
                <div class="flex h-12 items-center justify-center">
                    <span class="text-fg-dimmed text-xs">End of results</span>
                </div>
            {/if}
        {/if}
    </div>
</div>
