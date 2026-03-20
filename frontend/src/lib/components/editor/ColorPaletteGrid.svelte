<script lang="ts">
    import ColorSwatch from './ColorSwatch.svelte';
    import {
        getPalette,
        getLockedColors,
        getSelectedColors,
        hasColorSelection,
        hasAnySelection,
        clearColorSelection,
        shufflePalette,
        setPalette,
    } from '$lib/stores/theme.svelte';
    import {openColorPicker, showToast} from '$lib/stores/ui.svelte';
    import {ANSI_COLOR_NAMES} from '$lib/constants/colors';
    import {hslToHex} from '$lib/utils/color';

    let palette = $derived(getPalette());
    let locked = $derived(getLockedColors());
    let selected = $derived(getSelectedColors());
    let hasSelect = $derived(hasAnySelection());

    const labels = [
        'BG',
        'Red',
        'Green',
        'Yellow',
        'Blue',
        'Magenta',
        'Cyan',
        'FG',
    ];

    async function randomPalette() {
        const hue = Math.random() * 360;
        const sat = 40 + Math.random() * 40;
        const lit = 45 + Math.random() * 20;
        const seed = hslToHex(hue, sat, lit);
        try {
            const {GeneratePaletteFromColor} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GeneratePaletteFromColor(seed);
            setPalette(result);
            showToast(`Random palette from ${seed}`);
        } catch {
            showToast('Random generation failed');
        }
    }
</script>

<div>
    <div class="mb-2 flex items-center justify-between">
        <h3
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-wider"
        >
            Palette
            {#if hasSelect}
                <span class="text-accent ml-1">(selection)</span>
            {/if}
        </h3>
        <div class="flex items-center gap-2">
            <button
                class="text-fg-dimmed hover:text-accent text-[9px] transition-colors"
                onclick={randomPalette}
                title="Generate palette from a random shade (experimental)"
                >Random</button
            >
            <button
                class="text-fg-dimmed hover:text-accent text-[9px] transition-colors"
                onclick={shufflePalette}
                title="Shuffle ANSI color roles (experimental)">Shuffle</button
            >
            {#if hasSelect}
                <button
                    class="text-accent hover:text-accent-hover text-[9px] transition-colors"
                    onclick={clearColorSelection}>Clear</button
                >
            {/if}
            <span class="text-fg-dimmed text-[9px]">Shift+click select</span>
        </div>
    </div>

    <!-- 8 columns, each has normal + bright stacked with label -->
    <div class="grid grid-cols-8 gap-1.5">
        {#each Array(8) as _, i}
            <div class="flex flex-col gap-1.5">
                <ColorSwatch
                    color={palette[i]}
                    index={i}
                    label={ANSI_COLOR_NAMES[i]}
                    locked={locked[i] || false}
                    selected={selected[i] || false}
                    onclick={() => openColorPicker(i)}
                />
                <ColorSwatch
                    color={palette[i + 8]}
                    index={i + 8}
                    label={ANSI_COLOR_NAMES[i + 8]}
                    locked={locked[i + 8] || false}
                    selected={selected[i + 8] || false}
                    onclick={() => openColorPicker(i + 8)}
                />
                <span
                    class="text-fg-dimmed mt-0.5 select-none text-center text-[8px]"
                    >{labels[i]}</span
                >
            </div>
        {/each}
    </div>
</div>
