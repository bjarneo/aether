<script lang="ts">
    import ColorSwatch from './ColorSwatch.svelte';
    import SectionHeader from '$lib/components/shared/SectionHeader.svelte';
    import {
        getPalette,
        getLockedColors,
        setLockedColor,
        getSelectedColors,
        hasColorSelection,
        hasAnySelection,
        clearColorSelection,
        shufflePalette,
        setPalette,
    } from '$lib/stores/theme.svelte';
    import {openColorPicker, showToast} from '$lib/stores/ui.svelte';
    import {ANSI_COLOR_NAMES, ANSI_SLOT_ROLES} from '$lib/constants/colors';
    import {hslToHex, copyColor} from '$lib/utils/color';

    let palette = $derived(getPalette());
    let locked = $derived(getLockedColors());
    let selected = $derived(getSelectedColors());
    let hasSelect = $derived(hasAnySelection());

    let gridEl = $state<HTMLDivElement | null>(null);
    let focusedIndex = $state(0);

    // 8 cols × 2 rows; top row 0..7, bottom row 8..15.
    function nextIndex(idx: number, key: string): number | null {
        if (key === 'ArrowRight')
            return idx === 7 ? 0 : idx === 15 ? 8 : idx + 1;
        if (key === 'ArrowLeft')
            return idx === 0 ? 7 : idx === 8 ? 15 : idx - 1;
        if (key === 'ArrowDown') return idx < 8 ? idx + 8 : idx - 8;
        if (key === 'ArrowUp') return idx >= 8 ? idx - 8 : idx + 8;
        if (key === 'Home') return idx < 8 ? 0 : 8;
        if (key === 'End') return idx < 8 ? 7 : 15;
        return null;
    }

    function focusSwatch(idx: number) {
        focusedIndex = idx;
        queueMicrotask(() => {
            gridEl
                ?.querySelector<HTMLElement>(`[data-swatch-idx="${idx}"]`)
                ?.focus();
        });
    }

    function handleGridKey(e: KeyboardEvent) {
        const tgt = e.target as HTMLElement;
        const idxAttr = tgt.dataset?.swatchIdx;
        if (idxAttr === undefined) return;
        const idx = Number(idxAttr);

        const next = nextIndex(idx, e.key);
        if (next !== null) {
            e.preventDefault();
            focusSwatch(next);
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!locked[idx]) openColorPicker(idx);
        } else if (
            (e.key === 'l' || e.key === 'L') &&
            !e.ctrlKey &&
            !e.metaKey
        ) {
            e.preventDefault();
            setLockedColor(idx, !locked[idx]);
        } else if (
            (e.key === 'c' || e.key === 'C') &&
            !e.ctrlKey &&
            !e.metaKey
        ) {
            e.preventDefault();
            copyColor(palette[idx]);
        }
    }

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
            showToast('Couldn’t generate a random palette');
        }
    }
</script>

<div>
    <SectionHeader title="Palette" suffix={hasSelect ? '(selection)' : ''}>
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
        <span class="text-fg-dimmed text-[9px]"
            >Shift+click select · ←→↑↓ navigate · L lock · C copy</span
        >
    </SectionHeader>

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- 8 columns, each has normal + bright stacked with label -->
    <div
        bind:this={gridEl}
        class="grid grid-cols-8 gap-1.5"
        role="grid"
        tabindex={-1}
        aria-label="Palette colours"
        onkeydown={handleGridKey}
    >
        {#each Array(8) as _, i}
            <div class="flex flex-col gap-1.5">
                <ColorSwatch
                    color={palette[i]}
                    index={i}
                    label={ANSI_COLOR_NAMES[i]}
                    role={ANSI_SLOT_ROLES[i]}
                    contrastAgainst={palette[0]}
                    locked={locked[i] || false}
                    selected={selected[i] || false}
                    focused={focusedIndex === i}
                    onclick={() => openColorPicker(i)}
                />
                <ColorSwatch
                    color={palette[i + 8]}
                    index={i + 8}
                    label={ANSI_COLOR_NAMES[i + 8]}
                    role={ANSI_SLOT_ROLES[i + 8]}
                    contrastAgainst={palette[0]}
                    locked={locked[i + 8] || false}
                    selected={selected[i + 8] || false}
                    focused={focusedIndex === i + 8}
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
