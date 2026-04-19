<script lang="ts">
    import {
        getAdditionalImages,
        addAdditionalImage,
        removeAdditionalImage,
        swapMainWithAdditional,
    } from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    let thumbnails = $state<Record<string, string>>({});

    $effect(() => {
        const images = getAdditionalImages();
        for (const img of images) {
            if (!thumbnails[img]) loadThumb(img);
        }
    });

    async function loadThumb(path: string) {
        try {
            const {GetThumbnail, ReadImageAsDataURL} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const thumbPath = await GetThumbnail(path);
            const dataUrl = await ReadImageAsDataURL(thumbPath);
            thumbnails = {...thumbnails, [path]: dataUrl};
        } catch {
            try {
                const {ReadImageAsDataURL} = await import(
                    '../../../../wailsjs/go/main/App'
                );
                const dataUrl = await ReadImageAsDataURL(path);
                thumbnails = {...thumbnails, [path]: dataUrl};
            } catch {}
        }
    }

    async function handleAdd() {
        try {
            const {OpenFileDialog} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const path = await OpenFileDialog();
            if (path) {
                addAdditionalImage(path);
                showToast('Image added');
            }
        } catch {}
    }

    function handleRemove(path: string) {
        removeAdditionalImage(path);
        const copy = {...thumbnails};
        delete copy[path];
        thumbnails = copy;
    }

    function handleSetAsMain(path: string) {
        swapMainWithAdditional(path);
        showToast('Set as main wallpaper');
    }
</script>

<div>
    <div class="mb-2 flex items-center justify-between">
        <h3
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
        >
            Additional Images
        </h3>
        <button
            class="text-fg-primary bg-bg-elevated hover:bg-border-focus px-4 py-1.5 text-[11px] font-medium transition-colors duration-100"
            onclick={handleAdd}>+ Add</button
        >
    </div>

    {#if getAdditionalImages().length > 0}
        <div class="grid grid-cols-4 gap-1.5">
            {#each getAdditionalImages() as img (img)}
                <div
                    class="border-border bg-bg-primary group relative aspect-video overflow-hidden border"
                >
                    {#if thumbnails[img]}
                        <img
                            src={thumbnails[img]}
                            alt=""
                            class="h-full w-full object-cover"
                        />
                    {:else}
                        <div
                            class="flex h-full w-full items-center justify-center"
                        >
                            <span class="text-fg-dimmed text-[9px]">...</span>
                        </div>
                    {/if}
                    <button
                        class="hover:bg-accent/80 absolute left-0.5 top-0.5 flex h-4 items-center justify-center bg-black/60 px-1 text-[8px]
              font-medium uppercase tracking-wider text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onclick={() => handleSetAsMain(img)}
                        aria-label="Set as main wallpaper"
                        title="Set as main wallpaper">Main</button
                    >
                    <button
                        class="hover:bg-destructive/80 absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center bg-black/60
              text-[9px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                        onclick={() => handleRemove(img)}
                        aria-label="Remove image">x</button
                    >
                </div>
            {/each}
        </div>
    {/if}
</div>
