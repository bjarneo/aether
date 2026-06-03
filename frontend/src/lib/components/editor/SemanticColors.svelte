<script lang="ts">
    import {
        getPalette,
        getExtendedColors,
        getLightMode,
        getSelectedExtColors,
        toggleExtColorSelection,
        clearExtendedColor,
        clearExtendedColors,
    } from '$lib/stores/theme.svelte';
    import {
        openColorPicker,
        openExtendedColorPicker,
        setEyedropperActive,
    } from '$lib/stores/ui.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import SectionHeader from '$lib/components/shared/SectionHeader.svelte';
    import ContextMenu from '$lib/components/shared/ContextMenu.svelte';

    // Non-ANSI colors grouped by the role they play, so a tonal family reads as
    // one unit. Each item dispatches by `kind`:
    //   slot  - a base ANSI palette index (bg/fg/muted); edits that slot
    //   shade - a derived color that auto-derives from the palette but can be
    //           pinned to an explicit value (stored in the extended-colors map)
    //   ui    - accent/cursor/selection; an extended color, multi-selectable
    type Kind = 'slot' | 'shade' | 'ui';
    interface Item {
        key: string;
        label: string;
        kind: Kind;
        slot?: number;
    }
    const CARDS: {label: string; items: Item[]}[] = [
        {
            label: 'Background',
            items: [
                {key: 'darker_bg', label: 'Darker', kind: 'shade'},
                {key: 'dark_bg', label: 'Dark', kind: 'shade'},
                {key: 'background', label: 'Base', kind: 'slot', slot: 0},
                {key: 'lighter_bg', label: 'Lighter', kind: 'shade'},
            ],
        },
        {
            label: 'Foreground',
            items: [
                {key: 'muted', label: 'Muted', kind: 'slot', slot: 8},
                {key: 'dark_fg', label: 'Dark', kind: 'shade'},
                {key: 'foreground', label: 'Base', kind: 'slot', slot: 7},
                {key: 'light_fg', label: 'Light', kind: 'shade'},
                {key: 'bright_fg', label: 'Bright', kind: 'shade'},
            ],
        },
        {
            label: 'Accent',
            items: [
                {key: 'orange', label: 'Orange', kind: 'shade'},
                {key: 'brown', label: 'Brown', kind: 'shade'},
            ],
        },
        {
            label: 'UI',
            items: [
                {key: 'accent', label: 'Accent', kind: 'ui'},
                {key: 'cursor', label: 'Cursor', kind: 'ui'},
                {key: 'selection_foreground', label: 'Sel FG', kind: 'ui'},
                {key: 'selection_background', label: 'Sel BG', kind: 'ui'},
            ],
        },
    ];
    const SHADE_KEYS = CARDS.flatMap(c =>
        c.items.filter(i => i.kind === 'shade').map(i => i.key)
    );

    let palette = $derived(getPalette());
    let ext = $derived(getExtendedColors());
    let selectedExt = $derived(getSelectedExtColors());
    let pinnedCount = $derived(SHADE_KEYS.filter(k => ext[k]).length);

    // Derived shade values come from the Go side (pinned or auto-derived).
    let computedVars = $state<Record<string, string>>({});
    const appModule = import('../../../../wailsjs/go/main/App');
    let computeToken = 0;
    $effect(() => {
        // Touch reactive sources so the swatches refresh when the base palette,
        // a pin, or light mode changes (the read happens later, in the promise).
        const _ = getPalette();
        const __ = JSON.stringify(getExtendedColors());
        const ___ = getLightMode();
        const token = ++computeToken;
        appModule
            .then(({ComputeVariables}) =>
                ComputeVariables(
                    getPalette(),
                    getExtendedColors(),
                    getLightMode()
                )
            )
            .then(result => {
                if (token === computeToken) computedVars = result || {};
            })
            .catch(() => {});
    });

    function colorOf(item: Item): string {
        if (item.kind === 'slot') return palette[item.slot ?? 0] || '#000000';
        if (item.kind === 'ui')
            return ext[item.key] || computedVars[item.key] || '#000000';
        return computedVars[item.key] || '#000000';
    }

    function edit(item: Item) {
        if (item.kind === 'slot') openColorPicker(item.slot ?? 0);
        else openExtendedColorPicker(item.key);
    }

    function handleClick(e: MouseEvent, item: Item) {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            copyColor(colorOf(item));
        } else if (e.shiftKey && item.kind === 'ui') {
            e.preventDefault();
            toggleExtColorSelection(item.key);
        } else {
            edit(item);
        }
    }

    function resetAll() {
        clearExtendedColors(SHADE_KEYS);
    }

    let menu = $state<{open: boolean; x: number; y: number; item: Item | null}>(
        {
            open: false,
            x: 0,
            y: 0,
            item: null,
        }
    );
    function openMenu(e: MouseEvent, item: Item) {
        e.preventDefault();
        menu = {open: true, x: e.clientX, y: e.clientY, item};
    }

    let menuItems = $derived.by(() => {
        const item = menu.item;
        if (!item) return [];
        const items = [
            {
                kind: 'item' as const,
                label: 'Edit color…',
                onSelect: () => edit(item),
                kbd: 'Click',
            },
            {
                kind: 'item' as const,
                label: 'Copy hex',
                onSelect: () => copyColor(colorOf(item)),
                kbd: 'Ctrl+Click',
            },
            {
                kind: 'item' as const,
                label: 'Pick from wallpaper',
                onSelect: () => {
                    edit(item);
                    setEyedropperActive(true);
                },
            },
        ];
        if (item.kind === 'ui') {
            items.push({
                kind: 'item' as const,
                label: selectedExt[item.key] ? 'Deselect' : 'Add to selection',
                onSelect: () => toggleExtColorSelection(item.key),
                kbd: 'Shift+Click',
            });
        }
        if (item.kind === 'shade' && ext[item.key]) {
            return [
                ...items,
                {kind: 'divider' as const},
                {
                    kind: 'item' as const,
                    label: 'Reset to auto',
                    onSelect: () => clearExtendedColor(item.key),
                    danger: true,
                },
            ];
        }
        return items;
    });
</script>

<div class="mt-4">
    <SectionHeader title="Semantic Colors">
        {#if pinnedCount > 0}
            <button
                class="text-destructive/60 hover:text-destructive text-[10px] normal-case transition-colors"
                onclick={resetAll}
                title="Reset all pinned shades to auto"
            >
                Reset {pinnedCount} pinned
            </button>
        {/if}
    </SectionHeader>

    <div class="grid gap-2 sm:grid-cols-2">
        {#each CARDS as card}
            <div class="border-border bg-bg-secondary border p-2">
                <span
                    class="text-fg-dimmed mb-1.5 block text-[9px] font-medium uppercase tracking-wider"
                    >{card.label}</span
                >
                <div class="flex gap-1.5">
                    {#each card.items as item}
                        {@const hex = colorOf(item)}
                        {@const light = isLightColor(hex)}
                        {@const pinned =
                            item.kind === 'shade' && !!ext[item.key]}
                        {@const sel =
                            item.kind === 'ui' && !!selectedExt[item.key]}
                        <div class="flex min-w-0 flex-1 flex-col gap-1">
                            <button
                                class="group relative h-12 w-full overflow-hidden border transition-all duration-150
                                {pinned || sel
                                    ? 'border-accent border-2'
                                    : 'border-border hover:border-accent hover:z-10 hover:scale-[1.04]'}"
                                style:background-color={hex}
                                onclick={e => handleClick(e, item)}
                                oncontextmenu={e => openMenu(e, item)}
                                title={`${item.label} · ${hex}${
                                    pinned
                                        ? ' · pinned'
                                        : item.kind === 'shade'
                                          ? ' · auto'
                                          : ''
                                }\nClick edit · Ctrl+click copy · Right-click menu`}
                            >
                                {#if pinned}
                                    <span
                                        class="bg-accent absolute right-1 top-1 h-2 w-2"
                                        aria-hidden="true"
                                    ></span>
                                {/if}
                                {#if sel}
                                    <span
                                        class="bg-accent absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2"
                                        aria-hidden="true"
                                    ></span>
                                {/if}
                                <span
                                    class="absolute inset-0 flex select-none items-center justify-center font-mono text-[9px] opacity-0 transition-opacity group-hover:opacity-100
                                    {light ? 'text-black/80' : 'text-white/80'}"
                                    style="text-shadow: 0 1px 3px {light
                                        ? 'rgba(255,255,255,0.3)'
                                        : 'rgba(0,0,0,0.5)'}">{hex}</span
                                >
                            </button>
                            <span
                                class="text-fg-dimmed truncate text-center text-[9px]"
                                >{item.label}</span
                            >
                        </div>
                    {/each}
                </div>
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
