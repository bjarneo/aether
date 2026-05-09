<script lang="ts">
    let {children}: {children: import('svelte').Snippet} = $props();
</script>

<kbd
    class="border-border bg-bg-surface text-fg-primary inline-flex items-center border px-1 font-mono text-[10px] leading-[1.4]"
>
    {@render children()}
</kbd>
