<script lang="ts">
    import {debounce} from '$lib/utils/debounce';

    let {
        filters = $bindable(),
        onpreview,
    }: {filters: any; onpreview: () => void} = $props();

    const debouncedPreview = debounce(() => onpreview(), 300);

    function update(key: string, value: number) {
        filters = {...filters, [key]: value};
        debouncedPreview();
    }

    let activeTab = $state<'adjust' | 'effects' | 'pro' | 'presets'>('adjust');

    const defaults: Record<string, number> = {
        blur: 0,
        brightness: 100,
        contrast: 100,
        saturation: 100,
        hueRotate: 0,
        sepia: 0,
        invert: 0,
        oilPaint: 0,
        pixelate: 0,
        exposure: 0,
        vignette: 0,
        sharpen: 0,
        grain: 0,
        shadows: 0,
        highlights: 0,
        temperature: 0,
        tint: 0,
        fade: 0,
        clarity: 0,
        posterize: 0,
        noise: 0,
    };

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
        filters = {...defaults, ...preset.values};
        debouncedPreview();
    }

    const tabs = [
        {
            id: 'adjust',
            label: 'Light',
            sliders: [
                {
                    key: 'brightness',
                    label: 'Brightness',
                    min: 0,
                    max: 200,
                    step: 1,
                },
                {key: 'contrast', label: 'Contrast', min: 0, max: 200, step: 1},
                {
                    key: 'exposure',
                    label: 'Exposure',
                    min: -100,
                    max: 100,
                    step: 1,
                },
                {
                    key: 'shadows',
                    label: 'Shadows',
                    min: -100,
                    max: 100,
                    step: 1,
                },
                {
                    key: 'highlights',
                    label: 'Highlights',
                    min: -100,
                    max: 100,
                    step: 1,
                },
                {key: 'clarity', label: 'Clarity', min: 0, max: 100, step: 1},
                {key: 'fade', label: 'Fade', min: 0, max: 100, step: 1},
            ],
        },
        {
            id: 'effects',
            label: 'Color',
            sliders: [
                {
                    key: 'saturation',
                    label: 'Saturation',
                    min: 0,
                    max: 200,
                    step: 1,
                },
                {
                    key: 'temperature',
                    label: 'Temperature',
                    min: -100,
                    max: 100,
                    step: 1,
                },
                {key: 'tint', label: 'Tint', min: -100, max: 100, step: 1},
                {
                    key: 'hueRotate',
                    label: 'Hue Shift',
                    min: 0,
                    max: 360,
                    step: 1,
                },
                {key: 'sepia', label: 'Sepia', min: 0, max: 100, step: 1},
                {key: 'invert', label: 'Invert', min: 0, max: 100, step: 1},
                {
                    key: 'posterize',
                    label: 'Posterize',
                    min: 0,
                    max: 10,
                    step: 1,
                },
            ],
        },
        {
            id: 'pro',
            label: 'Detail',
            sliders: [
                {key: 'sharpen', label: 'Sharpen', min: 0, max: 100, step: 1},
                {key: 'blur', label: 'Blur', min: 0, max: 100, step: 1},
                {key: 'grain', label: 'Grain', min: 0, max: 10, step: 1},
                {key: 'noise', label: 'Color Noise', min: 0, max: 100, step: 1},
                {key: 'vignette', label: 'Vignette', min: 0, max: 100, step: 1},
                {key: 'oilPaint', label: 'Oil Paint', min: 0, max: 10, step: 1},
                {key: 'pixelate', label: 'Pixelate', min: 0, max: 100, step: 1},
            ],
        },
    ] as const;

    let currentSliders = $derived(
        tabs.find(t => t.id === activeTab)?.sliders || []
    );
</script>

<div class="flex h-full flex-col">
    <!-- Panel header -->
    <div class="border-b border-[rgba(255,255,255,0.06)] px-4 py-3">
        <span
            class="text-fg-dimmed text-[10px] font-medium uppercase tracking-widest"
            >Adjustments</span
        >
    </div>

    <!-- Tab navigation -->
    <div class="flex border-b border-[rgba(255,255,255,0.06)]">
        {#each [...tabs, {id: 'presets', label: 'Presets'}] as tab}
            <button
                class="flex-1 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-all duration-100
          {activeTab === tab.id
                    ? 'text-accent border-accent border-b-2'
                    : 'text-fg-dimmed hover:text-fg-secondary'}"
                onclick={() => (activeTab = tab.id as any)}>{tab.label}</button
            >
        {/each}
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
        {#if activeTab === 'presets'}
            <!-- Presets grid -->
            <div class="p-4">
                <div class="grid grid-cols-2 gap-2">
                    {#each presets as preset}
                        <button
                            class="text-fg-secondary hover:text-fg-primary border border-[rgba(255,255,255,0.06)] px-3 py-2.5 text-left
                text-[11px] font-medium transition-all duration-100 hover:bg-[rgba(255,255,255,0.04)]"
                            onclick={() => applyPreset(preset)}
                            >{preset.name}</button
                        >
                    {/each}
                </div>
            </div>
        {:else}
            <!-- Sliders -->
            <div class="space-y-4 p-4">
                {#each currentSliders as s}
                    {@const isModified = filters[s.key] !== defaults[s.key]}
                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <span class="text-fg-secondary text-[11px]"
                                >{s.label}</span
                            >
                            <!-- svelte-ignore a11y_no_static_element_interactions -->
                            <span
                                class="min-w-[36px] cursor-pointer text-right font-mono text-[11px] tabular-nums
                  {isModified ? 'text-fg-primary' : 'text-fg-dimmed'}"
                                role="button"
                                tabindex="-1"
                                ondblclick={() =>
                                    update(s.key, defaults[s.key])}
                                title="Double-click to reset"
                                >{filters[s.key]}</span
                            >
                        </div>
                        <input
                            type="range"
                            class="w-full cursor-pointer"
                            min={s.min}
                            max={s.max}
                            step={s.step}
                            value={filters[s.key]}
                            oninput={e =>
                                update(
                                    s.key,
                                    parseFloat(e.currentTarget.value)
                                )}
                            ondblclick={() => update(s.key, defaults[s.key])}
                        />
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
