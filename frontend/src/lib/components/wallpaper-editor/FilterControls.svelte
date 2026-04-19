<script lang="ts">
    import {debounce} from '$lib/utils/debounce';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import CurvesEditor from './CurvesEditor.svelte';
    import {
        DEFAULT_FILTERS,
        hasActiveCrop,
        hasCurve,
        hasPaletteGrade,
        hasTransform,
        buildPaletteLUT,
        autoLevelsCurve,
        autoContrastCurve,
        autoWhiteBalance,
        computeChannelHistograms,
        type Filters,
    } from '$lib/utils/canvas-filters';
    import {getPalette} from '$lib/stores/theme.svelte';
    import {isLightColor} from '$lib/utils/color';
    import {showToast} from '$lib/stores/ui.svelte';

    const MAX_PALETTE_STOPS = 4;

    type SliderDef = {
        key: string;
        label: string;
        min: number;
        max: number;
        step: number;
    };

    let {
        filters = $bindable(),
        onpreview,
        cropMode = $bindable(false),
        cropAspectRatio = 0,
        oncropaspectratio = (_r: number) => {},
        naturalWidth = 0,
        naturalHeight = 0,
        histogram = [] as number[],
        imgEl = null as HTMLImageElement | null,
    }: {
        filters: Filters;
        onpreview: () => void;
        cropMode?: boolean;
        cropAspectRatio?: number;
        oncropaspectratio?: (r: number) => void;
        naturalWidth?: number;
        naturalHeight?: number;
        histogram?: number[];
        imgEl?: HTMLImageElement | null;
    } = $props();

    const debouncedPreview = debounce(() => onpreview(), 300);

    const defaults: Record<string, number> =
        DEFAULT_FILTERS as unknown as Record<string, number>;

    function update(key: string, value: number) {
        filters = {...filters, [key]: value};
        debouncedPreview();
    }

    // Parse a typed value string to a clamped number. Returns null if invalid.
    function parseSliderValue(
        raw: string,
        min: number,
        max: number
    ): number | null {
        const n = parseFloat(raw);
        if (!isFinite(n)) return null;
        return Math.max(min, Math.min(max, n));
    }

    // Auto-enhance handlers — each analyses the image and applies a targeted
    // change. All three are individually reversible via undo.
    function handleAutoLevels() {
        if (histogram.length !== 256) return;
        const points = autoLevelsCurve(histogram);
        if (points.length === 0) {
            showToast('Image already uses full tonal range');
            return;
        }
        filters = {...filters, curvePoints: points};
        debouncedPreview();
        showToast('Auto levels applied');
    }

    function handleAutoContrast() {
        filters = {...filters, curvePoints: autoContrastCurve()};
        debouncedPreview();
        showToast('Auto contrast applied');
    }

    function handleAutoWhiteBalance() {
        if (!imgEl) return;
        const ch = computeChannelHistograms(imgEl);
        const {temperature, tint} = autoWhiteBalance(ch);
        if (Math.abs(temperature) < 2 && Math.abs(tint) < 2) {
            showToast('White balance already neutral');
            return;
        }
        filters = {...filters, temperature, tint};
        debouncedPreview();
        showToast(`Auto WB · temp ${temperature}, tint ${tint}`);
    }

    function handleStrength(v: number) {
        filters = {...filters, strength: v};
        debouncedPreview();
    }

    // Section expanded states
    let curvesExpanded = $state(true);
    let lightExpanded = $state(true);
    let colorExpanded = $state(false);
    let paletteExpanded = $state(false);
    let detailExpanded = $state(false);
    let transformExpanded = $state(false);
    let presetsExpanded = $state(false);

    // Rotate / flip handlers
    function rotateBy(delta: number) {
        const next = (((filters.rotate + delta) % 360) + 360) % 360;
        filters = {...filters, rotate: next};
        debouncedPreview();
    }

    function toggleFlipH() {
        filters = {...filters, flipH: !filters.flipH};
        debouncedPreview();
    }

    function toggleFlipV() {
        filters = {...filters, flipV: !filters.flipV};
        debouncedPreview();
    }

    function resetTransform() {
        filters = {...filters, rotate: 0, flipH: false, flipV: false};
        debouncedPreview();
    }

    // Custom presets persisted in localStorage.
    const CUSTOM_PRESETS_KEY = 'aether.customPresets';
    type CustomPreset = {name: string; values: Partial<Filters>};

    let customPresets = $state<CustomPreset[]>(loadCustomPresets());

    function loadCustomPresets(): CustomPreset[] {
        try {
            const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function persistCustomPresets() {
        try {
            localStorage.setItem(
                CUSTOM_PRESETS_KEY,
                JSON.stringify(customPresets)
            );
        } catch {
            // quota exceeded or storage disabled — silent fail
        }
    }

    /**
     * Build a Partial<Filters> containing only values that differ from the
     * defaults. This keeps saved presets small and lets them merge cleanly
     * over the baseline on apply.
     */
    function currentFilterDiff(): Partial<Filters> {
        const diff: Record<string, unknown> = {};
        const f = filters as unknown as Record<string, unknown>;
        const d = DEFAULT_FILTERS as unknown as Record<string, unknown>;
        for (const k of Object.keys(d)) {
            if (JSON.stringify(f[k]) !== JSON.stringify(d[k])) {
                diff[k] = f[k];
            }
        }
        return diff as Partial<Filters>;
    }

    function saveCustomPreset() {
        const diff = currentFilterDiff();
        if (Object.keys(diff).length === 0) {
            showToast('No adjustments to save');
            return;
        }
        const name = prompt('Preset name:', 'My Preset')?.trim();
        if (!name) return;
        customPresets = [
            ...customPresets.filter(p => p.name !== name),
            {name, values: diff},
        ];
        persistCustomPresets();
        showToast(`Saved "${name}"`);
    }

    function deleteCustomPreset(name: string) {
        customPresets = customPresets.filter(p => p.name !== name);
        persistCustomPresets();
    }

    function exportPresets() {
        const blob = new Blob([JSON.stringify(customPresets, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'aether-presets.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    function importPresets() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
                const text = await file.text();
                const parsed = JSON.parse(text);
                if (!Array.isArray(parsed)) throw new Error('Invalid format');
                const valid = parsed.filter(
                    (p: any) =>
                        p &&
                        typeof p.name === 'string' &&
                        p.values &&
                        typeof p.values === 'object'
                );
                // Merge: existing names keep local values unless overwritten
                const existing = new Map(customPresets.map(p => [p.name, p]));
                for (const p of valid) existing.set(p.name, p);
                customPresets = Array.from(existing.values());
                persistCustomPresets();
                showToast(`Imported ${valid.length} preset(s)`);
            } catch (e: any) {
                showToast('Import failed: ' + (e?.message || 'bad JSON'));
            }
        };
        input.click();
    }

    // Current theme palette — the colors.toml turned into pickable LUT stops.
    // Filter out duplicates and empties so the picker only shows distinct colors.
    let paletteColors = $derived.by(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const c of getPalette()) {
            if (!c || !c.startsWith('#') || c.length < 7) continue;
            const key = c.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            out.push(c);
        }
        return out;
    });

    function togglePaletteStop(hex: string) {
        const stops = filters.paletteStops;
        const idx = stops.findIndex(s => s.toLowerCase() === hex.toLowerCase());
        let next: string[];
        if (idx >= 0) {
            next = stops.filter((_, i) => i !== idx);
        } else if (stops.length >= MAX_PALETTE_STOPS) {
            return; // cap reached
        } else {
            next = [...stops, hex];
        }
        filters = {...filters, paletteStops: next};
        debouncedPreview();
    }

    function clearPaletteStops() {
        filters = {
            ...filters,
            paletteStops: [],
            paletteStrength: DEFAULT_FILTERS.paletteStrength,
        };
        debouncedPreview();
    }

    function setPaletteStrength(v: number) {
        filters = {...filters, paletteStrength: v};
        debouncedPreview();
    }

    function stopIndex(hex: string): number {
        return filters.paletteStops.findIndex(
            s => s.toLowerCase() === hex.toLowerCase()
        );
    }

    // Render the actual effective LUT as a data-URL strip, so the preview bar
    // shows exactly what will be applied to the image (HSL-space colorize with
    // luminance pinned to source) — not a naive straight-RGB gradient between
    // stops, which would misrepresent the grade.
    let rampPreviewUrl = $derived.by(() => {
        if (filters.paletteStops.length < 2) return '';
        const lut = buildPaletteLUT(filters.paletteStops);
        if (!lut) return '';
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';
        const img = ctx.createImageData(256, 1);
        for (let i = 0; i < 256; i++) {
            img.data[i * 4] = lut[i * 3];
            img.data[i * 4 + 1] = lut[i * 3 + 1];
            img.data[i * 4 + 2] = lut[i * 3 + 2];
            img.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        return canvas.toDataURL();
    });

    let paletteGradeActive = $derived(hasPaletteGrade(filters));

    // Slider definitions per section
    const lightSliders: SliderDef[] = [
        {key: 'brightness', label: 'Brightness', min: 0, max: 200, step: 1},
        {key: 'contrast', label: 'Contrast', min: 0, max: 200, step: 1},
        {key: 'exposure', label: 'Exposure', min: -100, max: 100, step: 1},
        {key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1},
        {key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1},
        {key: 'clarity', label: 'Clarity', min: 0, max: 100, step: 1},
        {key: 'fade', label: 'Fade', min: 0, max: 100, step: 1},
    ];

    const colorSliders: SliderDef[] = [
        {key: 'saturation', label: 'Saturation', min: 0, max: 200, step: 1},
        {
            key: 'temperature',
            label: 'Temperature',
            min: -100,
            max: 100,
            step: 1,
        },
        {key: 'tint', label: 'Tint', min: -100, max: 100, step: 1},
        {key: 'hueRotate', label: 'Hue Shift', min: 0, max: 360, step: 1},
        {key: 'sepia', label: 'Sepia', min: 0, max: 100, step: 1},
        {key: 'invert', label: 'Invert', min: 0, max: 100, step: 1},
        {key: 'posterize', label: 'Posterize', min: 0, max: 10, step: 1},
    ];

    const detailSliders: SliderDef[] = [
        {key: 'sharpen', label: 'Sharpen', min: 0, max: 100, step: 1},
        {key: 'blur', label: 'Blur', min: 0, max: 100, step: 1},
        {key: 'grain', label: 'Grain', min: 0, max: 10, step: 1},
        {key: 'noise', label: 'Color Noise', min: 0, max: 100, step: 1},
        {key: 'vignette', label: 'Vignette', min: 0, max: 100, step: 1},
        {key: 'oilPaint', label: 'Oil Paint', min: 0, max: 10, step: 1},
        {key: 'pixelate', label: 'Pixelate', min: 0, max: 100, step: 1},
    ];

    function hasModifiedSliders(sliders: SliderDef[]) {
        return sliders.some(
            s =>
                (filters as unknown as Record<string, number>)[s.key] !==
                defaults[s.key]
        );
    }

    // Presets
    const presets = [
        {
            name: 'Muted',
            values: {
                brightness: 95,
                contrast: 85,
                saturation: 60,
                exposure: -10,
            },
        },
        {
            name: 'Dramatic',
            values: {brightness: 90, contrast: 130, saturation: 110},
        },
        {
            name: 'Soft',
            values: {
                brightness: 105,
                contrast: 90,
                saturation: 95,
                exposure: 10,
            },
        },
        {
            name: 'Vintage',
            values: {brightness: 95, contrast: 110, saturation: 70, sepia: 30},
        },
        {
            name: 'Vibrant',
            values: {
                brightness: 105,
                contrast: 115,
                saturation: 140,
                exposure: 10,
            },
        },
        {
            name: 'Faded',
            values: {
                brightness: 110,
                contrast: 75,
                saturation: 65,
                exposure: 20,
            },
        },
        {name: 'Cool', values: {contrast: 105, saturation: 95, hueRotate: 200}},
        {name: 'Warm', values: {contrast: 105, saturation: 95, hueRotate: 20}},
        {
            name: 'Cinematic',
            values: {
                contrast: 120,
                saturation: 85,
                shadows: 20,
                highlights: -15,
                vignette: 35,
            },
        },
        {
            name: 'Film',
            values: {
                contrast: 95,
                saturation: 90,
                grain: 3,
                sepia: 15,
                vignette: 20,
            },
        },
        {
            name: 'Crisp',
            values: {contrast: 110, saturation: 105, sharpen: 40, exposure: 5},
        },
        {
            name: 'Portrait',
            values: {
                brightness: 102,
                contrast: 95,
                saturation: 92,
                shadows: 15,
                vignette: 25,
            },
        },
        {
            name: 'Golden Hour',
            values: {
                temperature: 40,
                brightness: 105,
                saturation: 115,
                fade: 10,
            },
        },
        {
            name: 'Nordic',
            values: {
                temperature: -30,
                contrast: 110,
                saturation: 80,
                fade: 15,
                clarity: 30,
            },
        },
        {
            name: 'Retro',
            values: {
                fade: 30,
                saturation: 70,
                contrast: 115,
                grain: 4,
                sepia: 10,
            },
        },
        {
            name: 'Poster',
            values: {posterize: 5, contrast: 130, saturation: 140},
        },
        {
            name: 'Dreamy',
            values: {blur: 15, brightness: 110, saturation: 80, fade: 20},
        },
        {
            name: 'Noir',
            values: {saturation: 0, contrast: 140, grain: 3, vignette: 40},
        },
    ];

    function applyPreset(preset: {name: string; values: Partial<Filters>}) {
        // Preset values that are absent leave the current state intact —
        // built-in presets (style-only) don't clobber crop/rotate/strength/
        // curve. Custom presets saved with those fields do restore them.
        const v = preset.values;
        filters = {
            ...DEFAULT_FILTERS,
            ...v,
            cropX: v.cropX ?? filters.cropX,
            cropY: v.cropY ?? filters.cropY,
            cropW: v.cropW ?? filters.cropW,
            cropH: v.cropH ?? filters.cropH,
            resizeW: v.resizeW ?? filters.resizeW,
            resizeH: v.resizeH ?? filters.resizeH,
            rotate: v.rotate ?? filters.rotate,
            flipH: v.flipH ?? filters.flipH,
            flipV: v.flipV ?? filters.flipV,
            curvePoints: v.curvePoints ?? filters.curvePoints,
            strength: v.strength ?? filters.strength,
        };
        debouncedPreview();
    }

    // Crop presets
    const cropPresets = [
        {label: 'Free', ratio: 0},
        {label: '1:1', ratio: 1},
        {label: '16:9', ratio: 16 / 9},
        {label: '4:3', ratio: 4 / 3},
        {label: '3:2', ratio: 3 / 2},
        {label: '9:16', ratio: 9 / 16},
        {label: '3:4', ratio: 3 / 4},
        {label: '2:3', ratio: 2 / 3},
    ];

    let resizeLocked = $state(true);

    function applyCropPreset(ratio: number) {
        oncropaspectratio(ratio);
        cropMode = true; // entering crop mode is expected when selecting an aspect
        if (ratio === 0) return;
        if (naturalWidth === 0 || naturalHeight === 0) return;

        const natAspect = naturalWidth / naturalHeight;
        const normRatio = ratio / natAspect;

        const cx = filters.cropX + filters.cropW / 2;
        const cy = filters.cropY + filters.cropH / 2;

        let w = filters.cropW;
        let h = w / normRatio;

        if (h > 1) {
            h = 1;
            w = h * normRatio;
        }
        if (w > 1) {
            w = 1;
            h = w / normRatio;
        }

        let x = cx - w / 2;
        let y = cy - h / 2;
        x = Math.max(0, Math.min(1 - w, x));
        y = Math.max(0, Math.min(1 - h, y));

        filters = {...filters, cropX: x, cropY: y, cropW: w, cropH: h};
        debouncedPreview();
    }

    function resetCrop() {
        filters = {...filters, cropX: 0, cropY: 0, cropW: 1, cropH: 1};
        oncropaspectratio(0);
        debouncedPreview();
    }

    function getCropAspect() {
        const w = filters.cropW * (naturalWidth || 1);
        const h = filters.cropH * (naturalHeight || 1);
        return h > 0 ? w / h : 1;
    }

    function handleResizeWidth(e: Event) {
        const w = parseInt((e.target as HTMLInputElement).value) || 0;
        const newFilters = {...filters, resizeW: w};
        if (resizeLocked && w > 0) {
            newFilters.resizeH = Math.round(w / getCropAspect());
        }
        filters = newFilters;
        debouncedPreview();
    }

    function handleResizeHeight(e: Event) {
        const h = parseInt((e.target as HTMLInputElement).value) || 0;
        const newFilters = {...filters, resizeH: h};
        if (resizeLocked && h > 0) {
            newFilters.resizeW = Math.round(h * getCropAspect());
        }
        filters = newFilters;
        debouncedPreview();
    }

    function resetResize() {
        filters = {...filters, resizeW: 0, resizeH: 0};
        debouncedPreview();
    }
</script>

{#snippet renderSliders(sliders: SliderDef[])}
    <div class="space-y-4 pt-1">
        {#each sliders as s}
            {@const value = (filters as unknown as Record<string, number>)[
                s.key
            ]}
            {@const isModified = value !== defaults[s.key]}
            <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-1">
                    <span class="text-fg-secondary text-[11px]">{s.label}</span>
                    <div class="flex items-center gap-1">
                        {#if isModified}
                            <button
                                type="button"
                                class="text-fg-dimmed hover:text-accent flex h-4 w-4 items-center justify-center transition-colors"
                                onclick={() => update(s.key, defaults[s.key])}
                                title="Reset to default"
                                aria-label="Reset {s.label}"
                            >
                                <svg
                                    viewBox="0 0 12 12"
                                    class="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M2.5 6a3.5 3.5 0 1 0 1-2.5" />
                                    <path d="M2 2.5v2h2" />
                                </svg>
                            </button>
                        {/if}
                        <input
                            type="text"
                            inputmode="numeric"
                            class="hover:text-fg-primary focus:text-fg-primary w-10 min-w-[32px] bg-transparent text-right font-mono text-[11px] tabular-nums outline-none transition-colors
                                {isModified
                                ? 'text-fg-primary'
                                : 'text-fg-dimmed'}"
                            value={String(value)}
                            onfocus={e => e.currentTarget.select()}
                            onkeydown={e => {
                                if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                    e.stopPropagation();
                                } else if (e.key === 'Escape') {
                                    e.currentTarget.value = String(
                                        (
                                            filters as unknown as Record<
                                                string,
                                                number
                                            >
                                        )[s.key]
                                    );
                                    e.currentTarget.blur();
                                    e.stopPropagation();
                                }
                            }}
                            onchange={e => {
                                const parsed = parseSliderValue(
                                    e.currentTarget.value,
                                    s.min,
                                    s.max
                                );
                                if (parsed === null) {
                                    e.currentTarget.value = String(value);
                                    return;
                                }
                                update(s.key, parsed);
                                e.currentTarget.value = String(parsed);
                            }}
                        />
                    </div>
                </div>
                <input
                    type="range"
                    class="w-full cursor-pointer"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    {value}
                    oninput={e =>
                        update(s.key, parseFloat(e.currentTarget.value))}
                    ondblclick={() => update(s.key, defaults[s.key])}
                />
            </div>
        {/each}
    </div>
{/snippet}

<div class="flex h-full flex-col">
    <div class="flex-1 overflow-y-auto">
        <!-- Master strength + auto-enhance — pinned above expandable sections. -->
        <section class="border-border bg-bg-elevated/30 space-y-3 border-b p-3">
            <div class="space-y-1.5">
                <div class="flex items-center justify-between gap-1">
                    <span
                        class="text-fg-secondary text-[11px] font-medium"
                        title="Scales all tonal and color adjustments proportionally. 100% = full effect; 0% = no change."
                        >Strength</span
                    >
                    <div class="flex items-center gap-1">
                        {#if filters.strength !== 100}
                            <button
                                type="button"
                                class="text-fg-dimmed hover:text-accent flex h-4 w-4 items-center justify-center transition-colors"
                                onclick={() => handleStrength(100)}
                                title="Reset to 100%"
                                aria-label="Reset strength"
                            >
                                <svg
                                    viewBox="0 0 12 12"
                                    class="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.2"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M2.5 6a3.5 3.5 0 1 0 1-2.5" />
                                    <path d="M2 2.5v2h2" />
                                </svg>
                            </button>
                        {/if}
                        <span
                            class="w-10 min-w-[32px] text-right font-mono text-[11px] tabular-nums
                                {filters.strength !== 100
                                ? 'text-fg-primary'
                                : 'text-fg-dimmed'}">{filters.strength}</span
                        >
                    </div>
                </div>
                <input
                    type="range"
                    class="w-full cursor-pointer"
                    min="0"
                    max="100"
                    step="1"
                    value={filters.strength}
                    oninput={e =>
                        handleStrength(parseFloat(e.currentTarget.value))}
                    ondblclick={() => handleStrength(100)}
                />
            </div>

            <div class="space-y-1.5">
                <span
                    class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                    >Auto Enhance</span
                >
                <div class="grid grid-cols-3 gap-1.5">
                    <button
                        type="button"
                        class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface border py-1.5 text-[10px] font-medium transition-colors"
                        onclick={handleAutoLevels}
                        disabled={histogram.length !== 256}
                        title="Stretch tonal range by setting a curve from 0.5th to 99.5th percentile luminance"
                        >Levels</button
                    >
                    <button
                        type="button"
                        class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface border py-1.5 text-[10px] font-medium transition-colors"
                        onclick={handleAutoContrast}
                        title="Apply a mild S-curve to boost contrast"
                        >Contrast</button
                    >
                    <button
                        type="button"
                        class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface border py-1.5 text-[10px] font-medium transition-colors"
                        onclick={handleAutoWhiteBalance}
                        disabled={!imgEl}
                        title="Auto white balance via gray-world assumption — equalize channel averages"
                        >White Bal.</button
                    >
                </div>
            </div>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Curves"
                bind:expanded={curvesExpanded}
                suffix={hasCurve(filters) ? ' \u2022' : ''}
            >
                <div class="pt-1">
                    <CurvesEditor
                        bind:points={filters.curvePoints}
                        {histogram}
                        onchange={debouncedPreview}
                    />
                </div>
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Light"
                bind:expanded={lightExpanded}
                suffix={hasModifiedSliders(lightSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(lightSliders)}
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Color"
                bind:expanded={colorExpanded}
                suffix={hasModifiedSliders(colorSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(colorSliders)}
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Palette Grade"
                bind:expanded={paletteExpanded}
                suffix={paletteGradeActive ? ' \u2022' : ''}
            >
                <div class="space-y-3 pt-1">
                    <p class="text-fg-dimmed text-[10px] leading-relaxed">
                        Click up to {MAX_PALETTE_STOPS} theme colors to build a tone
                        ramp (shadows → highlights). Preserves original brightness;
                        only repaints hue and saturation.
                    </p>

                    <!-- Palette swatch grid -->
                    <div class="grid grid-cols-8 gap-1">
                        {#each paletteColors as hex}
                            {@const idx = stopIndex(hex)}
                            {@const picked = idx >= 0}
                            {@const capped =
                                !picked &&
                                filters.paletteStops.length >=
                                    MAX_PALETTE_STOPS}
                            <button
                                type="button"
                                class="relative aspect-square border transition-all duration-100
                                    {picked
                                    ? 'border-accent ring-accent/40 ring-1'
                                    : 'border-border hover:border-border-focus'}
                                    {capped ? 'opacity-30' : ''}"
                                style="background-color: {hex}"
                                title={picked
                                    ? `Stop ${idx + 1} · ${hex} — click to remove`
                                    : capped
                                      ? `Max ${MAX_PALETTE_STOPS} stops`
                                      : `${hex} — click to add as stop`}
                                disabled={capped}
                                onclick={() => togglePaletteStop(hex)}
                            >
                                {#if picked}
                                    <span
                                        class="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums"
                                        style="color: {isLightColor(hex)
                                            ? '#000'
                                            : '#fff'}">{idx + 1}</span
                                    >
                                {/if}
                            </button>
                        {/each}
                    </div>

                    <!-- Ramp preview — shows the actual LUT (what each source
                    luminance maps to), not a naive stop-to-stop RGB gradient.
                    Auto-sorted by luminance, so shadows are on the left. -->
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <span class="text-fg-dimmed text-[10px]">
                                {filters.paletteStops.length === 0
                                    ? 'No stops selected'
                                    : filters.paletteStops.length === 1
                                      ? '1 stop — pick one more'
                                      : `${filters.paletteStops.length} stops · auto-sorted`}
                            </span>
                            {#if filters.paletteStops.length > 0}
                                <button
                                    type="button"
                                    class="text-fg-dimmed hover:text-fg-secondary text-[10px] transition-colors"
                                    onclick={clearPaletteStops}>Clear</button
                                >
                            {/if}
                        </div>
                        {#if filters.paletteStops.length >= 2 && rampPreviewUrl}
                            <img
                                src={rampPreviewUrl}
                                alt="Effective LUT"
                                class="border-border h-6 w-full border"
                                style="image-rendering: pixelated; object-fit: fill;"
                            />
                        {:else}
                            <div
                                class="border-border h-6 border"
                                style={filters.paletteStops.length === 1
                                    ? `background: ${filters.paletteStops[0]}`
                                    : 'background: repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 4px, transparent 4px 8px)'}
                            ></div>
                        {/if}
                        <div
                            class="text-fg-dimmed flex justify-between text-[9px]"
                        >
                            <span>Shadows</span>
                            <span>Midtones</span>
                            <span>Highlights</span>
                        </div>
                    </div>

                    <!-- Strength slider (only matters once a ramp is valid) -->
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <span class="text-fg-secondary text-[11px]"
                                >Strength</span
                            >
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="min-w-[36px] cursor-pointer text-right font-mono text-[11px] tabular-nums
                                    {filters.paletteStrength !==
                                DEFAULT_FILTERS.paletteStrength
                                    ? 'text-fg-primary'
                                    : 'text-fg-dimmed'}"
                                role="button"
                                tabindex="-1"
                                ondblclick={() =>
                                    setPaletteStrength(
                                        DEFAULT_FILTERS.paletteStrength
                                    )}
                                title="Double-click to reset"
                                >{filters.paletteStrength}</span
                            >
                        </div>
                        <input
                            type="range"
                            class="w-full cursor-pointer disabled:opacity-40"
                            min="0"
                            max="100"
                            step="1"
                            disabled={filters.paletteStops.length < 2}
                            value={filters.paletteStrength}
                            oninput={e =>
                                setPaletteStrength(
                                    parseFloat(e.currentTarget.value)
                                )}
                            ondblclick={() =>
                                setPaletteStrength(
                                    DEFAULT_FILTERS.paletteStrength
                                )}
                        />
                        <p class="text-fg-dimmed text-[9px] leading-snug">
                            ≤ 50% reads as a tint · ≥ 60% rebuilds the image in
                            the palette.
                        </p>
                    </div>
                </div>
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Detail"
                bind:expanded={detailExpanded}
                suffix={hasModifiedSliders(detailSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(detailSliders)}
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection
                title="Transform"
                bind:expanded={transformExpanded}
                suffix={hasActiveCrop(filters) ||
                hasTransform(filters) ||
                filters.resizeW !== 0 ||
                filters.resizeH !== 0
                    ? ' \u2022'
                    : ''}
            >
                <div class="space-y-5 pt-1">
                    <!-- Rotate & Flip — baked into the exported image -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span
                                class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                                >Rotate &amp; Flip</span
                            >
                            {#if hasTransform(filters)}
                                <button
                                    type="button"
                                    class="text-fg-dimmed hover:text-fg-secondary text-[10px] transition-colors"
                                    onclick={resetTransform}>Reset</button
                                >
                            {/if}
                        </div>
                        <div class="grid grid-cols-4 gap-1.5">
                            <button
                                type="button"
                                class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface flex items-center justify-center border py-2 transition-colors"
                                onclick={() => rotateBy(-90)}
                                title="Rotate 90° counter-clockwise ( [ )"
                                aria-label="Rotate counter-clockwise"
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    class="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M3 8a5 5 0 1 1 2 4" />
                                    <path d="M3 5v3h3" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface flex items-center justify-center border py-2 transition-colors"
                                onclick={() => rotateBy(90)}
                                title="Rotate 90° clockwise ( ] )"
                                aria-label="Rotate clockwise"
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    class="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path d="M13 8a5 5 0 1 0 -2 4" />
                                    <path d="M13 5v3h-3" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                class="flex items-center justify-center border py-2 transition-colors
                                    {filters.flipH
                                    ? 'text-accent border-accent/30 bg-accent/10'
                                    : 'text-fg-secondary border-border hover:bg-bg-surface hover:text-fg-primary'}"
                                onclick={toggleFlipH}
                                title="Flip horizontal ( F )"
                                aria-label="Flip horizontal"
                                aria-pressed={filters.flipH}
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    class="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M8 2v12"
                                        stroke-dasharray="1.5 1.5"
                                    />
                                    <path
                                        d="M2 5h4l-2 3 2 3H2z"
                                        fill="currentColor"
                                        fill-opacity="0.3"
                                    />
                                    <path d="M14 5h-4l2 3-2 3h4z" />
                                </svg>
                            </button>
                            <button
                                type="button"
                                class="flex items-center justify-center border py-2 transition-colors
                                    {filters.flipV
                                    ? 'text-accent border-accent/30 bg-accent/10'
                                    : 'text-fg-secondary border-border hover:bg-bg-surface hover:text-fg-primary'}"
                                onclick={toggleFlipV}
                                title="Flip vertical ( V )"
                                aria-label="Flip vertical"
                                aria-pressed={filters.flipV}
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    class="h-3.5 w-3.5"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.4"
                                    stroke-linecap="round"
                                    stroke-linejoin="round"
                                >
                                    <path
                                        d="M2 8h12"
                                        stroke-dasharray="1.5 1.5"
                                    />
                                    <path
                                        d="M5 2v4l3-2 3 2V2z"
                                        fill="currentColor"
                                        fill-opacity="0.3"
                                    />
                                    <path d="M5 14v-4l3 2 3-2v4z" />
                                </svg>
                            </button>
                        </div>
                        {#if filters.rotate !== 0}
                            <span class="text-fg-dimmed text-[10px]"
                                >Rotated {filters.rotate}°</span
                            >
                        {/if}
                    </div>

                    <div class="border-border border-t"></div>

                    <!-- Crop -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between">
                            <span
                                class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                                >Crop</span
                            >
                            <button
                                type="button"
                                class="border px-2 py-0.5 text-[10px] transition-colors
                                    {cropMode
                                    ? 'text-accent border-accent/30 bg-accent/10'
                                    : 'text-fg-secondary border-border hover:bg-bg-surface'}"
                                onclick={() => (cropMode = !cropMode)}
                                title="Toggle crop mode ( C )"
                                aria-pressed={cropMode}
                                >{cropMode ? 'Done' : 'Crop'}</button
                            >
                        </div>
                        <div class="grid grid-cols-4 gap-1.5">
                            {#each cropPresets as preset}
                                <button
                                    class="border py-2 text-[10px] font-medium transition-all duration-100
                                        {cropAspectRatio === preset.ratio
                                        ? 'text-accent border-accent/30 bg-accent/10'
                                        : 'text-fg-secondary border-border hover:bg-bg-surface'}"
                                    onclick={() =>
                                        applyCropPreset(preset.ratio)}
                                    >{preset.label}</button
                                >
                            {/each}
                        </div>
                        {#if hasActiveCrop(filters)}
                            <button
                                class="text-fg-dimmed hover:text-fg-secondary text-[10px] transition-colors"
                                onclick={resetCrop}>Reset Crop</button
                            >
                        {/if}
                    </div>

                    <div class="border-border border-t"></div>

                    <!-- Resize -->
                    <div class="space-y-2">
                        <span
                            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                            >Resize</span
                        >
                        <div class="flex items-start gap-2">
                            <div class="flex-1 space-y-2">
                                <div class="space-y-1">
                                    <span class="text-fg-dimmed text-[10px]"
                                        >Width</span
                                    >
                                    <input
                                        type="number"
                                        class="text-fg-primary placeholder:text-fg-dimmed border-border bg-bg-surface w-full border px-2 py-1.5 text-[11px]"
                                        placeholder={String(
                                            Math.round(
                                                filters.cropW * naturalWidth
                                            ) || naturalWidth
                                        )}
                                        value={filters.resizeW || ''}
                                        oninput={handleResizeWidth}
                                    />
                                </div>
                                <div class="space-y-1">
                                    <span class="text-fg-dimmed text-[10px]"
                                        >Height</span
                                    >
                                    <input
                                        type="number"
                                        class="text-fg-primary placeholder:text-fg-dimmed border-border bg-bg-surface w-full border px-2 py-1.5 text-[11px]"
                                        placeholder={String(
                                            Math.round(
                                                filters.cropH * naturalHeight
                                            ) || naturalHeight
                                        )}
                                        value={filters.resizeH || ''}
                                        oninput={handleResizeHeight}
                                    />
                                </div>
                            </div>
                            <button
                                class="mt-5 flex h-[62px] w-6 items-center justify-center border transition-colors
                                    {resizeLocked
                                    ? 'border-accent/30 text-accent bg-accent/10'
                                    : 'text-fg-dimmed hover:text-fg-secondary border-border'}"
                                onclick={() => (resizeLocked = !resizeLocked)}
                                title={resizeLocked
                                    ? 'Unlock aspect ratio'
                                    : 'Lock aspect ratio'}
                            >
                                <svg
                                    viewBox="0 0 16 16"
                                    class="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="1.5"
                                >
                                    <rect
                                        x="3"
                                        y="8"
                                        width="10"
                                        height="6"
                                        rx="1"
                                    />
                                    <path
                                        d="M5 8V5.5a3 3 0 0 1 6 0{resizeLocked
                                            ? 'V8'
                                            : ''}"
                                    />
                                </svg>
                            </button>
                        </div>
                        <span class="text-fg-dimmed text-[10px]">
                            Original: {naturalWidth} x {naturalHeight}
                        </span>
                        {#if filters.resizeW !== 0 || filters.resizeH !== 0}
                            <button
                                class="text-fg-dimmed hover:text-fg-secondary text-[10px] transition-colors"
                                onclick={resetResize}>Reset Size</button
                            >
                        {/if}
                    </div>
                </div>
            </ExpandableSection>
        </section>

        <section class="border-border border-b p-3">
            <ExpandableSection title="Presets" bind:expanded={presetsExpanded}>
                <div class="space-y-3 pt-1">
                    <div class="flex items-center gap-1.5">
                        <button
                            type="button"
                            class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface flex-1 border py-1.5 text-[10px] font-medium transition-colors"
                            onclick={saveCustomPreset}
                            title="Save current adjustments as a named preset"
                            >Save current</button
                        >
                        <button
                            type="button"
                            class="text-fg-dimmed hover:text-fg-primary border-border hover:bg-bg-surface border px-2 py-1.5 text-[10px] transition-colors"
                            onclick={importPresets}
                            title="Import presets from a JSON file"
                            aria-label="Import presets"
                        >
                            <svg
                                viewBox="0 0 12 12"
                                class="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.4"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M6 8V2M3 5l3 3 3-3M2 10h8" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            class="text-fg-dimmed hover:text-fg-primary border-border hover:bg-bg-surface border px-2 py-1.5 text-[10px] transition-colors disabled:opacity-40"
                            onclick={exportPresets}
                            disabled={customPresets.length === 0}
                            title="Export custom presets to a JSON file"
                            aria-label="Export presets"
                        >
                            <svg
                                viewBox="0 0 12 12"
                                class="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.4"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <path d="M6 2v6M3 5l3-3 3 3M2 10h8" />
                            </svg>
                        </button>
                    </div>

                    {#if customPresets.length > 0}
                        <div class="space-y-1.5">
                            <span
                                class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                                >Custom</span
                            >
                            <div class="grid grid-cols-2 gap-2">
                                {#each customPresets as preset}
                                    <div
                                        class="border-border hover:bg-bg-surface relative flex items-stretch border transition-all duration-100"
                                    >
                                        <button
                                            class="text-fg-secondary hover:text-fg-primary flex-1 px-3 py-2.5 text-left text-[11px] font-medium"
                                            onclick={() => applyPreset(preset)}
                                            title={preset.name}
                                            >{preset.name}</button
                                        >
                                        <button
                                            class="text-fg-dimmed hover:text-destructive border-border border-l px-2 text-[10px] transition-colors"
                                            onclick={() =>
                                                deleteCustomPreset(preset.name)}
                                            title="Delete preset"
                                            aria-label="Delete {preset.name}"
                                            >✕</button
                                        >
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <div class="space-y-1.5">
                        <span
                            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                            >Built-in</span
                        >
                        <div class="grid grid-cols-2 gap-2">
                            {#each presets as preset}
                                <button
                                    class="text-fg-secondary hover:text-fg-primary border-border hover:bg-bg-surface border px-3 py-2.5
                                        text-left text-[11px] font-medium transition-all duration-100"
                                    onclick={() => applyPreset(preset)}
                                    >{preset.name}</button
                                >
                            {/each}
                        </div>
                    </div>
                </div>
            </ExpandableSection>
        </section>
    </div>
</div>
