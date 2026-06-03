<script lang="ts">
    import {
        getPalette,
        getExtendedColors,
        getLightMode,
        getAppOverrides,
        clearAppOverridesForApp,
        removeAppOverride,
    } from '$lib/stores/theme.svelte';
    import {openOverrideColorPicker} from '$lib/stores/ui.svelte';
    import {isLightColor, copyColor} from '$lib/utils/color';
    import ContextMenu from '$lib/components/shared/ContextMenu.svelte';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {appLabel} from '$lib/constants/apps';

    let expanded = $state(false);
    let selectedApp = $state('');
    let templateColors = $state<Record<string, string[]>>({});
    let computedVars = $state<Record<string, string>>({});

    // Short labels for the few ANSI colours that don't fit in a 60px swatch.
    // Anything not listed falls back to the raw role name (truncated by CSS).
    const SHORT_LABELS: Record<string, string> = {
        bright_black: 'br black',
        bright_red: 'br red',
        bright_green: 'br green',
        bright_yellow: 'br yellow',
        bright_blue: 'br blue',
        bright_magenta: 'br magenta',
        bright_cyan: 'br cyan',
        bright_white: 'br white',
        selection_foreground: 'sel fg',
        selection_background: 'sel bg',
        bright_fg: 'br fg',
    };

    let palette = $derived(getPalette());
    let extColors = $derived(getExtendedColors());
    let lightMode = $derived(getLightMode());
    let overrides = $derived(getAppOverrides());
    let appOverrides = $derived(
        selectedApp ? overrides[selectedApp] || {} : {}
    );

    let apps = $derived(Object.keys(templateColors).sort());

    let totalOverrideCount = $derived(
        Object.values(overrides).reduce(
            (sum, o) => sum + Object.keys(o).length,
            0
        )
    );
    let appOverrideCount = $derived(Object.keys(appOverrides).length);
    let appColors = $derived(templateColors[selectedApp] || []);

    let paletteKey = $derived(
        palette.join(',') + JSON.stringify(extColors) + lightMode
    );
    let lastPaletteKey = $state('');

    async function loadTemplateColors() {
        try {
            const {GetTemplateColors} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GetTemplateColors();
            templateColors = result || {};
            if (!selectedApp && Object.keys(templateColors).length > 0) {
                selectedApp = Object.keys(templateColors).sort()[0];
            }
        } catch {
            // ignore
        }
    }

    async function loadComputedVars() {
        try {
            const {ComputeVariables} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await ComputeVariables(
                palette,
                extColors,
                lightMode
            );
            computedVars = result || {};
            lastPaletteKey = paletteKey;
        } catch {
            // ignore
        }
    }

    $effect(() => {
        if (expanded) {
            if (Object.keys(templateColors).length === 0) {
                loadTemplateColors();
            }
            if (paletteKey !== lastPaletteKey) {
                loadComputedVars();
            }
        }
    });

    function getDisplayColor(role: string): string {
        return appOverrides[role] || computedVars[role] || '#000000';
    }

    function getRoleLabel(role: string): string {
        return SHORT_LABELS[role] || role.replace(/_/g, ' ');
    }

    let menu = $state({open: false, x: 0, y: 0, role: ''});

    function openMenu(e: MouseEvent, role: string) {
        e.preventDefault();
        menu = {open: true, x: e.clientX, y: e.clientY, role};
    }

    let menuItems = $derived.by(() => {
        const role = menu.role;
        if (!role) return [];
        const isOverridden = !!appOverrides[role];
        return [
            {
                kind: 'item' as const,
                label: 'Edit override…',
                onSelect: () => openOverrideColorPicker(selectedApp, role),
                kbd: 'Click',
            },
            {
                kind: 'item' as const,
                label: 'Copy hex',
                onSelect: () => copyColor(getDisplayColor(role)),
            },
            ...(isOverridden
                ? [
                      {kind: 'divider' as const},
                      {
                          kind: 'item' as const,
                          label: 'Reset to computed',
                          onSelect: () => removeAppOverride(selectedApp, role),
                          danger: true,
                      },
                  ]
                : []),
        ];
    });
</script>

<div>
    <ExpandableSection
        title="Template Overrides"
        bind:expanded
        suffix={totalOverrideCount > 0 ? ` (${totalOverrideCount})` : ''}
    >
        <div class="space-y-2.5">
            <!-- App chip picker -->
            <div class="flex flex-wrap items-center gap-1">
                {#each apps as app}
                    {@const count = overrides[app]
                        ? Object.keys(overrides[app]).length
                        : 0}
                    {@const active = selectedApp === app}
                    <button
                        type="button"
                        class="border px-2 py-0.5 text-[10px] transition-colors {active
                            ? 'bg-accent-muted border-accent text-accent'
                            : count > 0
                              ? 'border-accent/40 text-fg-secondary hover:border-accent'
                              : 'border-border text-fg-dimmed hover:text-fg-secondary hover:border-border-focus'}"
                        onclick={() => (selectedApp = app)}
                        aria-pressed={active}
                    >
                        {appLabel(app)}
                        {#if count > 0}
                            <span class="text-accent ml-1 font-mono text-[9px]"
                                >{count}</span
                            >
                        {/if}
                    </button>
                {/each}
                {#if appOverrideCount > 0}
                    <button
                        class="text-destructive/60 hover:text-destructive ml-auto text-[10px] transition-colors"
                        onclick={() => clearAppOverridesForApp(selectedApp)}
                        title="Reset all overrides for {appLabel(selectedApp)}"
                    >
                        Reset {appLabel(selectedApp)}
                    </button>
                {/if}
            </div>

            <!-- Color swatches for this app's template variables -->
            {#if appColors.length > 0}
                <div
                    class="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(60px,1fr))]"
                >
                    {#each appColors as role}
                        {@const display = getDisplayColor(role)}
                        {@const isOverridden = !!appOverrides[role]}
                        {@const light = isLightColor(display)}
                        <button
                            class="group relative flex h-9 cursor-pointer items-end justify-center overflow-hidden border px-1 transition-all duration-100
                            {isOverridden
                                ? 'border-accent border-2'
                                : 'border-border hover:border-border-focus'}"
                            style:background-color={display}
                            onclick={() =>
                                openOverrideColorPicker(selectedApp, role)}
                            oncontextmenu={e => openMenu(e, role)}
                            title="{role}{isOverridden
                                ? ` · override ${appOverrides[role]}`
                                : ` · computed ${display}`}\nClick edit · Right-click for menu"
                        >
                            <span
                                class="block w-full select-none truncate pb-0.5 text-center text-[8px] leading-none opacity-80 transition-opacity group-hover:opacity-100
                                {light ? 'text-black/85' : 'text-white/85'}"
                                style="text-shadow: 0 1px 2px {light
                                    ? 'rgba(255,255,255,0.4)'
                                    : 'rgba(0,0,0,0.5)'}"
                                >{getRoleLabel(role)}</span
                            >
                        </button>
                    {/each}
                </div>
            {:else if selectedApp}
                <p class="text-fg-dimmed text-[10px]">
                    No color variables in this template.
                </p>
            {/if}
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
