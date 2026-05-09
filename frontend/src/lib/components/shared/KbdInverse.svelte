<script lang="ts">
    let {children}: {children: import('svelte').Snippet} = $props();
</script>

<kbd
    class="border-bg-primary/30 bg-bg-primary/15 inline-flex items-center border px-1 font-mono text-[9px] leading-[1.4] opacity-90"
    aria-hidden="true"
>
    {@render children()}
</kbd>
