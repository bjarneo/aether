<script lang="ts">
    import {
        getExtendedColors,
        getSelectedExtColors,
        toggleExtColorSelection,
    } from '$lib/stores/theme.svelte';
    import {
        openExtendedColorPicker,
        setEyedropperActive,
    } from '$lib/stores/ui.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import {onActivate} from '$lib/utils/keyboard';
    import {EXTENDED_COLOR_ROLES} from '$lib/constants/colors';
    import LockIcon from '$lib/components/shared/LockIcon.svelte';
    import ContextMenu from '$lib/components/shared/ContextMenu.svelte';
    import SectionHeader from '$lib/components/shared/SectionHeader.svelte';

    let extColors = $derived(getExtendedColors());
    let selectedExt = $derived(getSelectedExtColors());

    let lockedExt = $state<Record<string, boolean>>({});

    function toggleLockBare(key: string) {
        lockedExt = {...lockedExt, [key]: !lockedExt[key]};
    }

    function toggleLock(key: string, event: MouseEvent) {
        event.stopPropagation();
        event.preventDefault();
        toggleLockBare(key);
    }

    let menu = $state({open: false, x: 0, y: 0, key: ''});

    function openMenu(e: MouseEvent, key: string) {
        e.preventDefault();
        menu = {open: true, x: e.clientX, y: e.clientY, key};
    }

    let menuItems = $derived.by(() => {
        const key = menu.key;
        if (!key) return [];
        return [
            {
                kind: 'item' as const,
                label: 'Edit color…',
                onSelect: () => openExtendedColorPicker(key),
                kbd: 'Click',
            },
            {
                kind: 'item' as const,
                label: 'Copy hex',
                onSelect: () => copyColor(extColors[key] || '#000000'),
                kbd: 'Ctrl+Click',
            },
            {kind: 'divider' as const},
            {
                kind: 'item' as const,
                label: lockedExt[key] ? 'Unlock' : 'Lock',
                onSelect: () =>
                    (lockedExt = {...lockedExt, [key]: !lockedExt[key]}),
            },
            {
                kind: 'item' as const,
                label: selectedExt[key] ? 'Deselect' : 'Add to selection',
                onSelect: () => toggleExtColorSelection(key),
                kbd: 'Shift+Click',
            },
            {kind: 'divider' as const},
            {
                kind: 'item' as const,
                label: 'Pick from wallpaper',
                onSelect: () => {
                    openExtendedColorPicker(key);
                    setEyedropperActive(true);
                },
            },
        ];
    });
</script>

<div class="mt-4">
    <SectionHeader title="Extended Colors" />
    <div class="grid grid-cols-4 gap-2">
        {#each EXTENDED_COLOR_ROLES as role}
            {@const hex = extColors[role.key] || '#000000'}
            {@const locked = lockedExt[role.key] || false}
            {@const sel = selectedExt[role.key] || false}
            {@const light = isLightColor(hex)}
            <div class="flex flex-col gap-1">
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div
                    class="group relative h-10 overflow-hidden border transition-all duration-150
            {locked
                        ? 'border-border cursor-default'
                        : sel
                          ? 'border-accent cursor-pointer border-2'
                          : 'hover:border-accent border-border cursor-pointer hover:z-10 hover:scale-[1.04]'}"
                    style:background-color={hex}
                    role="button"
                    tabindex="0"
                    onclick={e => {
                        if (e.ctrlKey || e.metaKey) {
                            e.preventDefault();
                            copyColor(hex);
                        } else if (e.shiftKey) {
                            e.preventDefault();
                            toggleExtColorSelection(role.key);
                        } else if (!locked) openExtendedColorPicker(role.key);
                    }}
                    oncontextmenu={e => openMenu(e, role.key)}
                    title={`${role.label}\n${hex}\nClick edit · Ctrl+click copy · Right-click for menu`}
                >
                    {#if sel}
                        <span
                            class="bg-accent absolute bottom-0.5 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
                        ></span>
                    {/if}
                    <span
                        class="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 cursor-pointer items-center justify-center
              {locked
                            ? light
                                ? 'text-black/60 hover:text-black'
                                : 'text-white/60 hover:text-white'
                            : 'opacity-0 transition-opacity hover:!opacity-100 group-hover:opacity-30 ' +
                              (light ? 'text-black' : 'text-white')}"
                        role="button"
                        tabindex="-1"
                        onclick={e => toggleLock(role.key, e)}
                        onkeydown={onActivate(() => toggleLockBare(role.key))}
                        title={locked ? 'Unlock' : 'Lock'}
                        aria-label={locked ? 'Unlock' : 'Lock'}
                    >
                        <LockIcon {locked} size="w-3 h-3" />
                    </span>

                    <span
                        class="absolute inset-0 flex items-center justify-center font-mono text-[10px]
            opacity-0 transition-opacity group-hover:opacity-100
            {light ? 'text-black/80' : 'text-white/80'}"
                        style="text-shadow: 0 1px 3px {light
                            ? 'rgba(255,255,255,0.3)'
                            : 'rgba(0,0,0,0.5)'}"
                    >
                        {hex}
                    </span>
                </div>
                <span class="text-fg-dimmed text-center text-[9px]"
                    >{role.label}</span
                >
            </div>
        {/each}
    </div>
</div>

<ContextMenu
    open={menu.open}
    x={menu.x}
    y={menu.y}
    items={menuItems}
    onclose={() => (menu = {...menu, open: false})}
/>
