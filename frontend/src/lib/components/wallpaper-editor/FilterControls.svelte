<script lang="ts">
    import {debounce} from '$lib/utils/debounce';
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {
        DEFAULT_FILTERS,
        hasActiveCrop,
        buildPaletteLUT,
        type Filters,
    } from '$lib/utils/canvas-filters';
    import {getPalette} from '$lib/stores/theme.svelte';
    import {isLightColor} from '$lib/utils/color';

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
    }: {
        filters: Filters;
        onpreview: () => void;
        cropMode?: boolean;
        cropAspectRatio?: number;
        oncropaspectratio?: (r: number) => void;
        naturalWidth?: number;
        naturalHeight?: number;
    } = $props();

    const debouncedPreview = debounce(() => onpreview(), 300);

    const defaults: Record<string, number> =
        DEFAULT_FILTERS as unknown as Record<string, number>;

    function update(key: string, value: number) {
        filters = {...filters, [key]: value};
        debouncedPreview();
    }

    // Section expanded states
    let lightExpanded = $state(true);
    let colorExpanded = $state(false);
    let paletteExpanded = $state(false);
    let detailExpanded = $state(false);
    let presetsExpanded = $state(false);

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

    let paletteGradeActive = $derived(
        filters.paletteStops.length >= 2 && filters.paletteStrength > 0
    );

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

    function applyPreset(preset: (typeof presets)[0]) {
        filters = {...DEFAULT_FILTERS, ...preset.values};
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
            {@const isModified =
                (filters as unknown as Record<string, number>)[s.key] !==
                defaults[s.key]}
            <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                    <span class="text-fg-secondary text-[11px]">{s.label}</span>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <span
                        class="min-w-[36px] cursor-pointer text-right font-mono text-[11px] tabular-nums
                            {isModified ? 'text-fg-primary' : 'text-fg-dimmed'}"
                        role="button"
                        tabindex="-1"
                        ondblclick={() => update(s.key, defaults[s.key])}
                        title="Double-click to reset"
                        >{(filters as unknown as Record<string, number>)[
                            s.key
                        ]}</span
                    >
                </div>
                <input
                    type="range"
                    class="w-full cursor-pointer"
                    min={s.min}
                    max={s.max}
                    step={s.step}
                    value={(filters as unknown as Record<string, number>)[
                        s.key
                    ]}
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
        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
            <ExpandableSection
                title="Light"
                bind:expanded={lightExpanded}
                suffix={hasModifiedSliders(lightSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(lightSliders)}
            </ExpandableSection>
        </section>

        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
            <ExpandableSection
                title="Color"
                bind:expanded={colorExpanded}
                suffix={hasModifiedSliders(colorSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(colorSliders)}
            </ExpandableSection>
        </section>

        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
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
                                    : 'border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.25)]'}
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
                                class="h-6 w-full border border-[rgba(255,255,255,0.08)]"
                                style="image-rendering: pixelated; object-fit: fill;"
                            />
                        {:else}
                            <div
                                class="h-6 border border-[rgba(255,255,255,0.08)]"
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

        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
            <ExpandableSection
                title="Detail"
                bind:expanded={detailExpanded}
                suffix={hasModifiedSliders(detailSliders) ? ' \u2022' : ''}
            >
                {@render renderSliders(detailSliders)}
            </ExpandableSection>
        </section>

        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
            <ExpandableSection
                title="Transform"
                bind:expanded={cropMode}
                suffix={hasActiveCrop(filters) ||
                filters.resizeW !== 0 ||
                filters.resizeH !== 0
                    ? ' \u2022'
                    : ''}
            >
                <div class="space-y-5 pt-1">
                    <!-- Crop -->
                    <div class="space-y-2">
                        <span
                            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
                            >Crop</span
                        >
                        <div class="grid grid-cols-4 gap-1.5">
                            {#each cropPresets as preset}
                                <button
                                    class="border py-2 text-[10px] font-medium transition-all duration-100
                                        {cropAspectRatio === preset.ratio
                                        ? 'text-accent border-accent/30 bg-accent/10'
                                        : 'text-fg-secondary border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.04)]'}"
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

                    <div class="border-t border-[rgba(255,255,255,0.06)]"></div>

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
                                        class="text-fg-primary placeholder:text-fg-dimmed w-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[11px]"
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
                                        class="text-fg-primary placeholder:text-fg-dimmed w-full border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.04)] px-2 py-1.5 text-[11px]"
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
                                    : 'text-fg-dimmed hover:text-fg-secondary border-[rgba(255,255,255,0.06)]'}"
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

        <section class="border-b border-[rgba(255,255,255,0.06)] p-3">
            <ExpandableSection title="Presets" bind:expanded={presetsExpanded}>
                <div class="grid grid-cols-2 gap-2 pt-1">
                    {#each presets as preset}
                        <button
                            class="text-fg-secondary hover:text-fg-primary border border-[rgba(255,255,255,0.06)] px-3 py-2.5 text-left
                                text-[11px] font-medium transition-all duration-100 hover:bg-[rgba(255,255,255,0.04)]"
                            onclick={() => applyPreset(preset)}
                            >{preset.name}</button
                        >
                    {/each}
                </div>
            </ExpandableSection>
        </section>
    </div>
</div>
