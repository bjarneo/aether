<script lang="ts">
    import {
        getCachedThumbnail,
        loadThumbnail,
        isThumbnailCached,
    } from '$lib/stores/imagecache.svelte';
    import {observeIntersection} from '$lib/utils/intersection';

    let {path, alt = ''}: {path: string; alt?: string} = $props();

    let element: HTMLDivElement;
    let triggered = $state(false);
    let cached = $derived(getCachedThumbnail(path));

    $effect(() => {
        if (!element || isThumbnailCached(path)) return;
        return observeIntersection(
            element,
            entry => {
                if (entry.isIntersecting && !triggered) {
                    triggered = true;
                    loadThumbnail(path);
                }
            },
            {rootMargin: '200px'}
        );
    });
</script>

<div bind:this={element} class="flex h-full w-full items-center justify-center">
    {#if cached}
        <img src={cached} {alt} class="h-full w-full object-cover" />
    {:else}
        <span class="text-fg-dimmed text-[9px]">...</span>
    {/if}
</div>
