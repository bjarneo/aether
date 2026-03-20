<script lang="ts">
    let {locked, size = 'w-3.5 h-3.5'}: {locked: boolean; size?: string} =
        $props();
</script>

<svg
    class={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
    {#if locked}
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    {:else}
        <path d="M7 11V7a5 5 0 0 1 9.9-1"></path>
    {/if}
</svg>
