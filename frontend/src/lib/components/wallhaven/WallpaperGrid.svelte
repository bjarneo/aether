<script lang="ts">
    import WallpaperCard from './WallpaperCard.svelte';
    import ImagePreview from '$lib/components/shared/ImagePreview.svelte';
    import {getCardSize, CARD_MIN_WIDTH} from '$lib/stores/cardsize.svelte';
    import type {wallhaven} from '../../../../wailsjs/go/models';

    type Wallpaper = wallhaven.WallpaperInfo;

    let {wallpapers}: {wallpapers: Wallpaper[]} = $props();
    let previewIndex = $state(-1);

    function getPreviewSrc(wp: Wallpaper): string {
        return wp.path || wp.thumbs?.original || wp.thumbs?.large;
    }
</script>

<div
    class="grid gap-3"
    style:grid-template-columns="repeat(auto-fill, minmax({CARD_MIN_WIDTH[
        getCardSize()
    ]}px, 1fr))"
>
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
