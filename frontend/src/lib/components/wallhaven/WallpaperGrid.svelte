<script lang="ts">
    import WallpaperCard from './WallpaperCard.svelte';
    import ImagePreview from '$lib/components/shared/ImagePreview.svelte';

    let {wallpapers}: {wallpapers: any[]} = $props();
    let previewIndex = $state(-1);

    function getPreviewSrc(wp: any): string {
        return wp.path || wp.thumbs?.original || wp.thumbs?.large;
    }
</script>

<div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
    {#each wallpapers as wp, i (wp.id)}
        <WallpaperCard wallpaper={wp} onpreview={() => (previewIndex = i)} />
    {/each}
</div>

<ImagePreview
    src={previewIndex >= 0 ? getPreviewSrc(wallpapers[previewIndex]) : ''}
    alt={previewIndex >= 0 ? wallpapers[previewIndex].id : ''}
    open={previewIndex >= 0}
    onclose={() => (previewIndex = -1)}
    hasPrev={previewIndex > 0}
    hasNext={previewIndex < wallpapers.length - 1}
    onprev={() => previewIndex--}
    onnext={() => previewIndex++}
/>
