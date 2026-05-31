<script lang="ts">
    import type {Snippet} from 'svelte';

    // Header row for an always-open content section in the editor (Palette,
    // Extended Colors, Additional Images). Keeps the title typography identical
    // across sections; the optional `children` snippet holds right-aligned
    // actions. Distinct from `SectionLabel` (the full-bleed sidebar group bar).
    let {
        title,
        suffix = '',
        children,
    }: {
        title: string;
        suffix?: string;
        children?: Snippet;
    } = $props();
</script>

<div class="mb-2 flex items-center justify-between gap-2">
    <h3 class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider">
        {title}{#if suffix}<span class="text-accent ml-1 normal-case"
                >{suffix}</span
            >{/if}
    </h3>
    {#if children}
        <div class="flex items-center gap-2">
            {@render children()}
        </div>
    {/if}
</div>
