<script lang="ts">
    import WallhavenFilters from './WallhavenFilters.svelte';
    import WallpaperGrid from './WallpaperGrid.svelte';
    import {
        getResults,
        getIsSearching,
        getIsLoadingMore,
        getHasMore,
        getQuery,
        setQuery,
        search,
        loadMore,
    } from '$lib/stores/wallhaven.svelte';
    import {observeIntersection} from '$lib/utils/intersection';
    import EmptyState from '$lib/components/shared/EmptyState.svelte';
    import LoadingState from '$lib/components/shared/LoadingState.svelte';

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
        {#if getIsSearching() && getResults().length === 0}
            <LoadingState message="Searching wallhaven…" />
        {:else if getResults().length === 0}
            <EmptyState
                title={getQuery()
                    ? 'No matches found'
                    : 'No wallpapers to show'}
                body={getQuery()
                    ? `Nothing on wallhaven matches "${getQuery()}" with the current filters. Try a different query or reset filters.`
                    : 'Try a search term, or browse by category and purity to discover wallpapers.'}
                actionLabel={getQuery() ? 'Clear search' : undefined}
                onaction={getQuery()
                    ? () => {
                          setQuery('');
                          search();
                      }
                    : undefined}
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
                        <circle cx="11" cy="11" r="7"></circle>
                        <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
                    </svg>
                {/snippet}
            </EmptyState>
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
