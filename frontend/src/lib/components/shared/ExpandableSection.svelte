<script lang="ts">
    import type {Snippet} from 'svelte';

    let {
        title,
        expanded = $bindable(false),
        suffix = '',
        children,
    }: {
        title: string;
        expanded?: boolean;
        suffix?: string;
        children: Snippet;
    } = $props();
</script>

<div>
    <button
        class="text-fg-dimmed mb-2 flex w-full items-center justify-between text-[10px] font-medium uppercase tracking-wider"
        onclick={() => (expanded = !expanded)}
    >
        <span
            >{title}{#if suffix}
                <span class="text-accent normal-case">{suffix}</span>{/if}</span
        >
        <span class="text-[10px]">{expanded ? '\u25BC' : '\u25B6'}</span>
    </button>

    {#if expanded}
        {@render children()}
    {/if}
</div>
