<script lang="ts">
    let {size = 'h-4 w-4'}: {size?: string} = $props();
</script>

<svg
    class={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    aria-hidden="true"
>
    <path d="M18 6L6 18M6 6l12 12"></path>
</svg>
