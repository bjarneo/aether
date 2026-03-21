<script lang="ts">
    import {
        getPalette,
        getExtendedColors,
        getLightMode,
        getAppOverrides,
        clearAppOverridesForApp,
    } from '$lib/stores/theme.svelte';
    import {openOverrideColorPicker} from '$lib/stores/ui.svelte';
    import {isLightColor} from '$lib/utils/color';

    let expanded = $state(false);
    let selectedApp = $state('');
    let templateColors = $state<Record<string, string[]>>({});
    let computedVars = $state<Record<string, string>>({});

    // Short labels for color roles
    const SHORT_LABELS: Record<string, string> = {
        background: 'BG',
        foreground: 'FG',
        bg: 'BG',
        fg: 'FG',
        black: 'Blk',
        red: 'Red',
        green: 'Grn',
        yellow: 'Yel',
        blue: 'Blu',
        magenta: 'Mag',
        cyan: 'Cyn',
        white: 'Wht',
        bright_black: 'B.Blk',
        bright_red: 'B.Red',
        bright_green: 'B.Grn',
        bright_yellow: 'B.Yel',
        bright_blue: 'B.Blu',
        bright_magenta: 'B.Mag',
        bright_cyan: 'B.Cyn',
        bright_white: 'B.Wht',
        accent: 'Acc',
        cursor: 'Cur',
        selection_foreground: 'SelF',
        selection_background: 'SelB',
        dark_bg: 'D.BG',
        darker_bg: 'Dr.BG',
        lighter_bg: 'L.BG',
        dark_fg: 'D.FG',
        light_fg: 'L.FG',
        bright_fg: 'B.FG',
        muted: 'Mut',
        orange: 'Org',
        brown: 'Brn',
        purple: 'Pur',
        bright_purple: 'B.Pur',
        selection: 'Sel',
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

    // Track palette identity to know when to recompute
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
</script>

<div>
    <button
        class="mb-2 flex w-full items-center justify-between"
        onclick={() => (expanded = !expanded)}
    >
        <h3
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
        >
            Template Overrides
            {#if totalOverrideCount > 0}
                <span class="text-accent ml-1">({totalOverrideCount})</span>
            {/if}
        </h3>
        <svg
            class="text-fg-dimmed h-3 w-3 transition-transform duration-150 {expanded
                ? 'rotate-180'
                : ''}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
        >
            <path d="M6 9l6 6 6-6"></path>
        </svg>
    </button>

    {#if expanded}
        <div class="space-y-3">
            <!-- App selector -->
            <div class="flex items-center gap-2">
                <select
                    class="bg-bg-surface border-border text-fg-primary focus:border-border-focus flex-1 border px-2 py-1 text-[11px] outline-none"
                    bind:value={selectedApp}
                >
                    {#each apps as app}
                        {@const count = overrides[app]
                            ? Object.keys(overrides[app]).length
                            : 0}
                        <option value={app}
                            >{app}{count > 0 ? ` (${count})` : ''}</option
                        >
                    {/each}
                </select>
                {#if appOverrideCount > 0}
                    <button
                        class="text-destructive/60 hover:text-destructive text-[9px] transition-colors"
                        onclick={() => clearAppOverridesForApp(selectedApp)}
                        title="Reset all overrides for {selectedApp}"
                    >
                        Reset
                    </button>
                {/if}
            </div>

            <!-- Color swatches for this app's template variables -->
            {#if appColors.length > 0}
                <div class="flex flex-wrap gap-1">
                    {#each appColors as role}
                        {@const display = getDisplayColor(role)}
                        {@const isOverridden = !!appOverrides[role]}
                        {@const light = isLightColor(display)}
                        <button
                            class="group relative flex h-8 min-w-[38px] flex-1 cursor-pointer items-end justify-center overflow-hidden border transition-all duration-100
                            {isOverridden
                                ? 'border-accent'
                                : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.15)]'}"
                            style:background-color={display}
                            onclick={() =>
                                openOverrideColorPicker(selectedApp, role)}
                            title="{role}{isOverridden
                                ? ` (override: ${appOverrides[role]})`
                                : ''}"
                        >
                            <span
                                class="select-none pb-0.5 text-[7px] leading-none opacity-70 transition-opacity group-hover:opacity-100
                                {light ? 'text-black/80' : 'text-white/80'}"
                                >{SHORT_LABELS[role] || role}</span
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
    {/if}
</div>
