<script lang="ts">
    import {
        getCardSize,
        setCardSize,
        type CardSize,
    } from '$lib/stores/cardsize.svelte';

    // Shared S / M / L segmented control for the grid card size. Writes the
    // single shared preference, so every grid tab stays in sync.
    const sizeOptions: {value: CardSize; label: string; title: string}[] = [
        {value: 'small', label: 'S', title: 'Small cards'},
        {value: 'medium', label: 'M', title: 'Medium cards'},
        {value: 'large', label: 'L', title: 'Large cards'},
    ];
</script>

<div class="flex items-center gap-0.5" title="Card size">
    {#each sizeOptions as opt}
        <button
            type="button"
            class="border px-1.5 py-0.5 text-[10px] transition-colors
            {getCardSize() === opt.value
                ? 'text-accent border-accent bg-accent-muted'
                : 'text-fg-dimmed border-border hover:text-fg-secondary'}"
            onclick={() => setCardSize(opt.value)}
            title={opt.title}
            aria-pressed={getCardSize() === opt.value}>{opt.label}</button
        >
    {/each}
</div>
