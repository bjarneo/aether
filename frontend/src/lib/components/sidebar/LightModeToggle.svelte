<script lang="ts">
    import {getLightMode, setLightMode} from '$lib/stores/theme.svelte';

    let isLight = $derived(getLightMode());

    function toggle() {
        setLightMode(!isLight);
    }
</script>

<div class="flex items-center justify-between">
    <span
        class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
        >Light Mode</span
    >
    <button
        class="relative h-5 w-9 transition-colors duration-150
      {isLight ? 'bg-accent' : 'bg-bg-surface border-border border'}"
        onclick={toggle}
        role="switch"
        aria-checked={isLight}
        aria-label="Toggle light mode"
    >
        <span
            class="bg-fg-primary absolute left-0.5 top-0.5 h-4 w-4 transition-transform duration-150
        {isLight ? 'translate-x-4' : 'translate-x-0'}"
        ></span>
    </button>
</div>
