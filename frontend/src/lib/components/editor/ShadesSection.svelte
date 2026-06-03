<script lang="ts">
    import {
        getPalette,
        getExtendedColors,
        getLightMode,
        clearExtendedColor,
        clearExtendedColors,
    } from '$lib/stores/theme.svelte';
    import {openExtendedColorPicker} from '$lib/stores/ui.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import ContextMenu from '$lib/components/shared/ContextMenu.svelte';

    // The "shade" semantic colors are derived-by-default (omarchy's fg/bg ramp
    // plus orange/brown). They only live in the extended-colors map when a user
    // pins one; otherwise the Go side derives them from the base palette.
    // ComputeVariables returns the effective value (pinned or derived), so the
    // swatches show what the theme will actually use and update live as the
    // base palette changes.
    const GROUPS: {label: string; keys: {key: string; label: string}[]}[] = [
        {
            label: 'Backgrounds',
            keys: [
                {key: 'lighter_bg', label: 'Lighter BG'},
                {key: 'dark_bg', label: 'Dark BG'},
                {key: 'darker_bg', label: 'Darker BG'},
            ],
        },
        {
            label: 'Foregrounds',
            keys: [
                {key: 'light_fg', label: 'Light FG'},
                {key: 'bright_fg', label: 'Bright FG'},
                {key: 'dark_fg', label: 'Dark FG'},
            ],
        },
        {
            label: 'Accents',
            keys: [
                {key: 'orange', label: 'Orange'},
                {key: 'brown', label: 'Brown'},
            ],
        },
    ];
    const SHADE_KEYS = GROUPS.flatMap(g => g.keys.map(k => k.key));

    let expanded = $state(true);
    let ext = $derived(getExtendedColors());
    let pinnedCount = $derived(SHADE_KEYS.filter(k => ext[k]).length);

    let computedVars = $state<Record<string, string>>({});
    const appModule = import('../../../../wailsjs/go/main/App');

    // Token guards against a stale ComputeVariables resolve clobbering a newer
    // one when the palette changes rapidly (same pattern as ColorPickerDialog).
    let computeToken = 0;
    $effect(() => {
        if (!expanded) return;
        // Touch the reactive sources so the derived swatches refresh when the
        // base palette, a pin, or light mode changes.
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

    function colorOf(key: string): string {
        // ComputeVariables always returns every shade key (pinned or derived),
        // so once it resolves this is non-empty; '#000000' only covers the
        // first frame before the async result lands.
        return computedVars[key] || '#000000';
    }

    function resetAll() {
        clearExtendedColors(SHADE_KEYS);
    }

    let menu = $state({open: false, x: 0, y: 0, key: ''});
    function openMenu(e: MouseEvent, key: string) {
        e.preventDefault();
        menu = {open: true, x: e.clientX, y: e.clientY, key};
    }

    let menuItems = $derived.by(() => {
        const key = menu.key;
        if (!key) return [];
        const pinned = !!ext[key];
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
                onSelect: () => copyColor(colorOf(key)),
            },
            ...(pinned
                ? [
                      {kind: 'divider' as const},
                      {
                          kind: 'item' as const,
                          label: 'Reset to auto',
                          onSelect: () => clearExtendedColor(key),
                          danger: true,
                      },
                  ]
                : []),
        ];
    });
</script>

<div class="mt-4">
    <ExpandableSection
        title="Shades"
        bind:expanded
        suffix={pinnedCount > 0 ? ` (${pinnedCount} pinned)` : ''}
    >
        <div class="space-y-2.5">
            <div class="flex items-start gap-2">
                <p class="text-fg-dimmed flex-1 text-[10px]">
                    Auto-derived from your base colors. Click to pin a custom
                    value; pinned shades stay fixed while you adjust the base
                    colors.
                </p>
                {#if pinnedCount > 0}
                    <button
                        class="text-destructive/60 hover:text-destructive shrink-0 text-[10px] transition-colors"
                        onclick={resetAll}
                        title="Reset all pinned shades to auto"
                    >
                        Reset all
                    </button>
                {/if}
            </div>

            {#each GROUPS as group}
                <div>
                    <span
                        class="text-fg-dimmed mb-1 block text-[9px] uppercase tracking-wider"
                        >{group.label}</span
                    >
                    <div
                        class="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(84px,1fr))]"
                    >
                        {#each group.keys as shade}
                            {@const hex = colorOf(shade.key)}
                            {@const pinned = !!ext[shade.key]}
                            {@const light = isLightColor(hex)}
                            <div class="flex flex-col gap-1">
                                <button
                                    class="group relative h-14 w-full cursor-pointer overflow-hidden border transition-all duration-150
                                    {pinned
                                        ? 'border-accent border-2'
                                        : 'border-border hover:border-accent hover:z-10 hover:scale-[1.03]'}"
                                    style:background-color={hex}
                                    onclick={() =>
                                        openExtendedColorPicker(shade.key)}
                                    oncontextmenu={e => openMenu(e, shade.key)}
                                    title="{shade.label} · {hex}{pinned
                                        ? ' · pinned'
                                        : ' · auto'}\nClick edit · Right-click for menu"
                                >
                                    {#if pinned}
                                        <span
                                            class="bg-accent absolute right-1 top-1 h-2 w-2"
                                            aria-hidden="true"
                                        ></span>
                                    {/if}
                                    <span
                                        class="absolute inset-0 flex select-none items-center justify-center font-mono text-[10px] opacity-0 transition-opacity group-hover:opacity-100
                                        {light
                                            ? 'text-black/80'
                                            : 'text-white/80'}"
                                        style="text-shadow: 0 1px 3px {light
                                            ? 'rgba(255,255,255,0.3)'
                                            : 'rgba(0,0,0,0.5)'}">{hex}</span
                                    >
                                </button>
                                <span
                                    class="text-fg-dimmed text-center text-[10px]"
                                    >{shade.label}{#if pinned}<span
                                            class="text-accent"
                                            >&nbsp;&bull;</span
                                        >{/if}</span
                                >
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    </ExpandableSection>
</div>

<ContextMenu
    open={menu.open}
    x={menu.x}
    y={menu.y}
    items={menuItems}
    onclose={() => (menu = {...menu, open: false})}
/>
