<script lang="ts">
    import {
        setLockedColor,
        toggleColorSelection,
    } from '$lib/stores/theme.svelte';
    import {
        isLightColor,
        copyColor,
        contrastRatio,
        contrastLevel,
    } from '$lib/utils/color';
    import {setEyedropperActive} from '$lib/stores/ui.svelte';
    import {onActivate} from '$lib/utils/keyboard';
    import LockIcon from '$lib/components/shared/LockIcon.svelte';
    import ContextMenu from '$lib/components/shared/ContextMenu.svelte';

    let {
        color,
        index,
        label,
        role = '',
        contrastAgainst = '',
        locked,
        selected,
        focused = false,
        onclick,
    }: {
        color: string;
        index: number;
        label: string;
        role?: string;
        contrastAgainst?: string;
        locked: boolean;
        selected: boolean;
        focused?: boolean;
        onclick: () => void;
    } = $props();

    let menu = $state({open: false, x: 0, y: 0});

    function handleContextMenu(e: MouseEvent) {
        e.preventDefault();
        menu = {open: true, x: e.clientX, y: e.clientY};
    }

    let menuItems = $derived([
        {
            kind: 'item' as const,
            label: 'Edit color…',
            onSelect: onclick,
            kbd: 'Click',
        },
        {
            kind: 'item' as const,
            label: 'Copy hex',
            onSelect: () => copyColor(color),
            kbd: 'Ctrl+Click',
        },
        {kind: 'divider' as const},
        {
            kind: 'item' as const,
            label: locked ? 'Unlock' : 'Lock',
            onSelect: () => setLockedColor(index, !locked),
        },
        {
            kind: 'item' as const,
            label: selected ? 'Deselect' : 'Add to selection',
            onSelect: () => toggleColorSelection(index),
            kbd: 'Shift+Click',
        },
        {kind: 'divider' as const},
        {
            kind: 'item' as const,
            label: 'Pick from wallpaper',
            onSelect: () => {
                onclick();
                setEyedropperActive(true);
            },
        },
    ]);

    let ratio = $derived(
        contrastAgainst ? contrastRatio(color, contrastAgainst) : 0
    );
    let level = $derived(contrastAgainst ? contrastLevel(ratio) : 'fail');
    // Skip the badge for the background slot itself (BG vs BG = 1:1, useless).
    let showBadge = $derived(
        !!contrastAgainst &&
            color.toLowerCase() !== contrastAgainst.toLowerCase()
    );

    function toggleLock(event: MouseEvent) {
        event.stopPropagation();
        toggleLockBare();
    }

    function toggleLockBare() {
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

<!-- Keyboard handling lives on the parent ColorPaletteGrid (roving tabindex). -->
<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
    class="focus-visible:ring-accent focus-visible:ring-offset-bg-primary group relative h-14 w-full border transition-all duration-150 focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-1
    {locked
        ? 'border-border cursor-default'
        : selected
          ? 'border-accent cursor-pointer border-2'
          : 'hover:border-accent border-border cursor-pointer hover:z-10 hover:scale-[1.04] hover:shadow-lg'}"
    style:background-color={color}
    role="button"
    tabindex={focused ? 0 : -1}
    data-swatch-idx={index}
    onclick={handleClick}
    oncontextmenu={handleContextMenu}
    title={`${label}${role ? ` · ${role}` : ''}\n${color}${
        showBadge ? `\nContrast vs BG: ${ratio.toFixed(2)}:1 (${level})` : ''
    }\nClick edit · Ctrl+click copy · Shift+click select · Right-click for menu\n← → ↑ ↓ navigate · Enter open · L lock · C copy`}
>
    {#if selected}
        <span
            class="bg-accent absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
        ></span>
    {/if}

    {#if role}
        <span
            class="pointer-events-none absolute left-1 top-0.5 select-none font-mono text-[8px] font-semibold leading-none tracking-tight opacity-60 transition-opacity group-hover:opacity-90
            {light ? 'text-black/85' : 'text-white/85'}"
        >
            {role}
        </span>
    {/if}

    {#if showBadge}
        <span
            class="pointer-events-none absolute bottom-0.5 left-1 select-none font-mono text-[8px] font-semibold leading-none tracking-tight opacity-70 transition-opacity group-hover:opacity-100
            {level === 'fail'
                ? 'text-destructive'
                : light
                  ? 'text-black/80'
                  : 'text-white/80'}"
            aria-label={`Contrast ${ratio.toFixed(2)} to 1, ${level}`}
        >
            {level === 'fail' ? '!' : level}
        </span>
    {/if}

    <span
        class="absolute right-1 top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center
      {locked
            ? light
                ? 'text-black/60 hover:text-black'
                : 'text-white/60 hover:text-white'
            : 'opacity-0 transition-opacity hover:!opacity-100 group-hover:opacity-30 ' +
              (light ? 'text-black' : 'text-white')}"
        onclick={toggleLock}
        onkeydown={onActivate(toggleLockBare)}
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

<ContextMenu
    open={menu.open}
    x={menu.x}
    y={menu.y}
    items={menuItems}
    onclose={() => (menu = {...menu, open: false})}
/>
