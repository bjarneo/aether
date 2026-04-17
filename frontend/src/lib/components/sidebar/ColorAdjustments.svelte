<script lang="ts">
    import AdjustmentSlider from './AdjustmentSlider.svelte';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import CurvesEditor from '$lib/components/wallpaper-editor/CurvesEditor.svelte';
    import {
        getAdjustments,
        setAdjustments,
        getPalette,
        getBasePalette,
        setAdjustedPalette,
        setPalette,
        getLockedColors,
        getSelectedColors,
        hasColorSelection,
        getSelectedExtColors,
        hasExtColorSelection,
        hasAnySelection,
        getExtendedColors,
        getBaseExtendedColors,
        setAdjustedExtendedColors,
        getPaletteCurvePoints,
        setPaletteCurvePoints,
    } from '$lib/stores/theme.svelte';
    import {pushState} from '$lib/stores/history.svelte';
    import {ADJUSTMENT_LIMITS} from '$lib/constants/colors';
    import {DEFAULT_ADJUSTMENTS, type Adjustments} from '$lib/types/theme';
    import {debounce} from '$lib/utils/debounce';
    import {buildCurveLUT, applyCurveToColors} from '$lib/utils/canvas-filters';
    import {hexToRgb} from '$lib/utils/color';

    let adj = $derived(getAdjustments());
    let expanded = $state(true);
    let curvePoints = $state<[number, number][]>([]);

    // Sync store → local on external changes (undo/redo)
    $effect(() => {
        const stored = getPaletteCurvePoints();
        if (JSON.stringify(stored) !== JSON.stringify(curvePoints)) {
            curvePoints = stored;
        }
    });

    // Build a palette luminance histogram (Gaussian bumps at each color's L)
    let paletteHistogram = $derived.by(() => {
        const pal = getPalette();
        const hist = new Array(256).fill(0);
        const sigma = 8;
        for (const hex of pal) {
            if (!hex || hex.length < 7) continue;
            const {r, g, b} = hexToRgb(hex);
            const lum = Math.round((Math.max(r, g, b) + Math.min(r, g, b)) / 2);
            for (let i = 0; i < 256; i++) {
                const d = i - lum;
                hist[i] += Math.exp((-d * d) / (2 * sigma * sigma));
            }
        }
        return hist;
    });

    function handleCurveChange() {
        setPaletteCurvePoints(curvePoints);
        applyAdjustments(getAdjustments());
    }

    const sliderDefs = [
        {key: 'vibrance', label: 'Vibrance'},
        {key: 'saturation', label: 'Saturation'},
        {key: 'contrast', label: 'Contrast'},
        {key: 'brightness', label: 'Brightness'},
        {key: 'shadows', label: 'Shadows'},
        {key: 'highlights', label: 'Highlights'},
        {key: 'hueShift', label: 'Hue Shift'},
        {key: 'temperature', label: 'Temperature'},
        {key: 'tint', label: 'Tint'},
        {key: 'blackPoint', label: 'Black Point'},
        {key: 'whitePoint', label: 'White Point'},
        {key: 'gamma', label: 'Gamma'},
    ] as const;

    // Always adjust from basePalette so changes are non-destructive
    // Respects locked colors, color selection, and palette curve
    const applyAdjustments = debounce(async (adj: Adjustments) => {
        const base = getBasePalette();
        const locked = getLockedColors();
        const selected = getSelectedColors();
        const paletteSelActive = hasColorSelection();
        const selectedExt = getSelectedExtColors();
        const extSelActive = hasExtColorSelection();
        const anySelection = hasAnySelection();
        const baseExt = getBaseExtendedColors();
        const curveLUT =
            curvePoints.length > 0 ? buildCurveLUT(curvePoints) : null;
        try {
            const {AdjustPaletteColors} = await import(
                '../../../../wailsjs/go/main/App'
            );

            // Adjust main palette — skip entirely if only extended colors are selected
            if (!(anySelection && !paletteSelActive && extSelActive)) {
                const result = await AdjustPaletteColors(base, adj);
                if (result && Array.isArray(result) && result.length >= 16) {
                    let final = result.map((c: string, i: number) => {
                        if (locked[i]) return base[i];
                        if (paletteSelActive && !selected[i]) return base[i];
                        return c;
                    });
                    if (curveLUT) {
                        final = applyCurveToColors(final, curveLUT);
                    }
                    setAdjustedPalette(final);
                }
            }

            // Adjust extended colors — skip if only palette colors are selected
            if (!(anySelection && paletteSelActive && !extSelActive)) {
                const extValues = Object.values(baseExt);
                const extResult = await AdjustPaletteColors(extValues, adj);
                if (extResult && Array.isArray(extResult)) {
                    const extKeys = Object.keys(baseExt);
                    const adjusted: Record<string, string> = {};
                    extKeys.forEach((key, i) => {
                        const val =
                            extSelActive && !selectedExt[key]
                                ? baseExt[key]
                                : extResult[i];
                        adjusted[key] = val;
                    });
                    if (curveLUT) {
                        const curvedExt = applyCurveToColors(
                            Object.values(adjusted),
                            curveLUT
                        );
                        Object.keys(adjusted).forEach((key, i) => {
                            adjusted[key] = curvedExt[i];
                        });
                    }
                    setAdjustedExtendedColors(adjusted);
                }
            }
        } catch (e) {
            console.error('AdjustPaletteColors failed:', e);
        }
    }, 75);

    // Snapshot saved at the START of a drag, before any changes
    let preDragSnapshot: {
        palette: string[];
        ext: Record<string, string>;
        adj: Adjustments;
    } | null = null;

    function handleSliderInput(key: string, value: number) {
        if (!preDragSnapshot) {
            preDragSnapshot = {
                palette: [...getPalette()],
                ext: {...getExtendedColors()},
                adj: {...getAdjustments()},
            };
        }
        const newAdj = {...getAdjustments(), [key]: value};
        setAdjustments(newAdj as Adjustments);
        applyAdjustments(newAdj as Adjustments);
    }

    function handleSliderCommit() {
        if (preDragSnapshot) {
            pushState(
                preDragSnapshot.palette,
                preDragSnapshot.ext,
                preDragSnapshot.adj
            );
            preDragSnapshot = null;
        }
    }

    function resetAll() {
        pushState(getPalette(), getExtendedColors(), getAdjustments());
        setAdjustments({...DEFAULT_ADJUSTMENTS});
        curvePoints = [];
        setPaletteCurvePoints([]);
        setPalette(getBasePalette(), true);
    }
</script>

<ExpandableSection title="Color Adjustments" bind:expanded>
    <div class="mb-3">
        <CurvesEditor
            bind:points={curvePoints}
            histogram={paletteHistogram}
            onchange={handleCurveChange}
        />
    </div>

    <button
        class="text-fg-dimmed hover:text-fg-secondary mb-2 text-[10px]"
        onclick={resetAll}
    >
        Reset All
    </button>
    <div class="flex flex-col gap-1.5">
        {#each sliderDefs as def}
            <AdjustmentSlider
                label={def.label}
                value={adj[def.key]}
                min={ADJUSTMENT_LIMITS[def.key].min}
                max={ADJUSTMENT_LIMITS[def.key].max}
                step={ADJUSTMENT_LIMITS[def.key].step}
                defaultValue={ADJUSTMENT_LIMITS[def.key].default}
                oninput={v => handleSliderInput(def.key, v)}
                oncommit={handleSliderCommit}
            />
        {/each}
    </div>
</ExpandableSection>
