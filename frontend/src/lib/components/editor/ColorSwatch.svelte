<script lang="ts">
    import {
        setLockedColor,
        toggleColorSelection,
    } from '$lib/stores/theme.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import LockIcon from '$lib/components/shared/LockIcon.svelte';

    let {
        color,
        index,
        label,
        locked,
        selected,
        onclick,
    }: {
        color: string;
        index: number;
        label: string;
        locked: boolean;
        selected: boolean;
        onclick: () => void;
    } = $props();

    function toggleLock(event: MouseEvent) {
        event.stopPropagation();
        setLockedColor(index, !locked);
    }

    function handleClick(event: MouseEvent) {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            copyColor(color);
            return;
        }
        if (event.shiftKey) {
            event.preventDefault();
            toggleColorSelection(index);
            return;
        }
        if (!locked) onclick();
    }

    let light = $derived(isLightColor(color));
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
    class="group relative h-14 w-full border transition-all duration-150
    {locked
        ? 'border-border cursor-default'
        : selected
          ? 'border-accent cursor-pointer border-2'
          : 'hover:border-accent border-border cursor-pointer hover:z-10 hover:scale-[1.04] hover:shadow-lg'}"
    style:background-color={color}
    onclick={handleClick}
    title={`${label}\n${color}\nCtrl+click to copy · Shift+click to select\nShift+C copy · Shift+V paste (when open)`}
>
    {#if selected}
        <span
            class="bg-accent absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
        ></span>
    {/if}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
        class="absolute right-1 top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center
      {locked
            ? light
                ? 'text-black/60 hover:text-black'
                : 'text-white/60 hover:text-white'
            : 'opacity-0 transition-opacity hover:!opacity-100 group-hover:opacity-30 ' +
              (light ? 'text-black' : 'text-white')}"
        onclick={toggleLock}
        role="button"
        tabindex="0"
        title={locked ? 'Unlock color' : 'Lock color'}
        aria-label={locked ? 'Unlock color' : 'Lock color'}
    >
        <LockIcon {locked} />
    </span>

    <span
        class="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-medium
      opacity-0 transition-opacity duration-150 group-hover:opacity-100
      {light ? 'text-black/80' : 'text-white/80'}"
        style="text-shadow: 0 1px 3px {light
            ? 'rgba(255,255,255,0.3)'
            : 'rgba(0,0,0,0.5)'}"
    >
        {color}
    </span>
</div>
