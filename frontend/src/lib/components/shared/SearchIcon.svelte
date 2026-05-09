<script lang="ts">
    let {
        size = 'h-3.5 w-3.5',
        strokeWidth = 2,
    }: {size?: string; strokeWidth?: number} = $props();
</script>

<svg
    class={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width={strokeWidth}
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
>
    <circle cx="11" cy="11" r="7"></circle>
    <line x1="21" y1="21" x2="16.5" y2="16.5"></line>
</svg>
