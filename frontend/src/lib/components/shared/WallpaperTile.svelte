<script lang="ts">
    import type {Snippet} from 'svelte';
    import TagPicker from './TagPicker.svelte';

    // Shared card for the Local and Favorites wallpaper grids. The thumbnail
    // source differs per view (lazy-loaded vs preloaded cache), so it arrives
    // as a `thumb` snippet; `topRight` is an optional slot for view-specific
    // actions (e.g. the favourites remove button). Clicking the thumbnail or
    // the Use button selects the wallpaper.
    let {
        path,
        name,
        isAdded = false,
        applying = false,
        onuse,
        onwallpaperonly,
        onpreview,
        onaddextra,
        thumb,
        topRight,
    }: {
        path: string;
        name: string;
        isAdded?: boolean;
        applying?: boolean;
        onuse: () => void;
        onwallpaperonly: () => void;
        onpreview: () => void;
        onaddextra: () => void;
        thumb: Snippet;
        topRight?: Snippet;
    } = $props();
</script>

<div
    class="bg-bg-surface border-border hover:border-border-focus group relative border transition-colors duration-100"
>
    <button
        class="w-full text-left"
        onclick={onuse}
        title="Set as wallpaper and open in editor"
    >
        <div
            class="bg-bg-primary flex aspect-video items-center justify-center overflow-hidden"
        >
            {@render thumb()}
        </div>
    </button>

    <button
        class="absolute left-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center transition-all duration-150
        {isAdded
            ? 'opacity-100'
            : 'opacity-0 hover:!opacity-100 group-hover:opacity-60'}"
        onclick={e => {
            e.stopPropagation();
            onaddextra();
        }}
        aria-label="Add to additional images"
    >
        <svg
            class="h-4 w-4 {isAdded ? 'text-accent' : 'text-white'}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
    </button>

    {#if topRight}
        {@render topRight()}
    {/if}

    <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
    >
        <button
            class="bg-accent hover:bg-accent-hover text-accent-fg pointer-events-auto min-w-[7rem] px-4 py-1.5 text-[11px] font-medium transition-colors"
            onclick={onuse}
            title="Set as wallpaper and open in editor">Use</button
        >
        <div class="flex items-center gap-2 text-[10px] text-white/85">
            <button
                class="pointer-events-auto px-1 transition-colors hover:text-white disabled:opacity-50"
                onclick={onwallpaperonly}
                disabled={applying}
                title="Apply this wallpaper without changing the current palette"
                >Wallpaper only</button
            >
            <span class="text-white/30" aria-hidden="true">·</span>
            <button
                class="pointer-events-auto px-1 transition-colors hover:text-white"
                onclick={onpreview}
                title="Preview wallpaper full-size">Preview</button
            >
        </div>
    </div>

    <div class="flex items-center gap-1.5 px-2 py-1">
        <TagPicker {path} />
        <span class="text-fg-dimmed flex-1 truncate text-[10px]">{name}</span>
    </div>
</div>
