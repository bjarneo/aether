<script lang="ts">
    import {
        getColorPickerIndex,
        getColorPickerExtKey,
        getColorPickerOverrideApp,
        getColorPickerOverrideRole,
        closeColorPicker,
        getEyedropperActive,
        setEyedropperActive,
    } from '$lib/stores/ui.svelte';
    import {
        getPalette,
        setColor,
        getLockedColors,
        setLockedColor,
        getExtendedColors,
        setExtendedColor,
        getAppOverrides,
        setAppOverride,
        removeAppOverride,
    } from '$lib/stores/theme.svelte';
    import {
        ANSI_COLOR_NAMES,
        EXTENDED_COLOR_LABELS,
    } from '$lib/constants/colors';
    import {onDestroy} from 'svelte';
    import {
        hexToRgb,
        rgbToHex,
        hexToHsl,
        hslToHex,
        hexToOklch,
        oklchToHex,
        isValidHex,
        relativeLuminance,
        contrastLevel,
    } from '$lib/utils/color';
    import {
        getRecentColors,
        pushRecentColor,
    } from '$lib/stores/recentColors.svelte';
    import ShadeGrid from './ShadeGrid.svelte';

    const ROLE_LABELS: Record<string, string> = {
        background: 'Background',
        foreground: 'Foreground',
        bg: 'Background',
        fg: 'Foreground',
        black: 'Black',
        red: 'Red',
        green: 'Green',
        yellow: 'Yellow',
        blue: 'Blue',
        magenta: 'Magenta',
        cyan: 'Cyan',
        white: 'White',
        bright_black: 'Bright Black',
        bright_red: 'Bright Red',
        bright_green: 'Bright Green',
        bright_yellow: 'Bright Yellow',
        bright_blue: 'Bright Blue',
        bright_magenta: 'Bright Magenta',
        bright_cyan: 'Bright Cyan',
        bright_white: 'Bright White',
        accent: 'Accent',
        cursor: 'Cursor',
        selection_foreground: 'Selection FG',
        selection_background: 'Selection BG',
        dark_bg: 'Dark BG',
        darker_bg: 'Darker BG',
        lighter_bg: 'Lighter BG',
        dark_fg: 'Dark FG',
        light_fg: 'Light FG',
        bright_fg: 'Bright FG',
        muted: 'Muted',
        orange: 'Orange',
        brown: 'Brown',
        purple: 'Purple',
        bright_purple: 'Bright Purple',
        selection: 'Selection',
    };

    let idx = $derived(getColorPickerIndex());
    let extKey = $derived(getColorPickerExtKey());
    let overrideApp = $derived(getColorPickerOverrideApp());
    let overrideRole = $derived(getColorPickerOverrideRole());
    let isExtended = $derived(extKey !== '');
    let isOverride = $derived(overrideApp !== '' && overrideRole !== '');

    let overrideValue = $derived(
        isOverride ? getAppOverrides()[overrideApp]?.[overrideRole] || '' : ''
    );

    let computedVars = $state<Record<string, string>>({});

    $effect(() => {
        if (isOverride) {
            import('../../../../wailsjs/go/main/App')
                .then(({ComputeVariables}) =>
                    ComputeVariables(
                        getPalette(),
                        getExtendedColors(),
                        false
                    ).then(result => {
                        computedVars = result || {};
                    })
                )
                .catch(() => {});
        }
    });

    function getOverrideBaseColor(): string {
        return computedVars[overrideRole] || '#000000';
    }

    let currentColor = $derived(
        isOverride
            ? overrideValue || getOverrideBaseColor()
            : isExtended
              ? getExtendedColors()[extKey] || '#000000'
              : getPalette()[idx] || '#000000'
    );

    let locked = $derived(
        !isExtended && !isOverride ? getLockedColors()[idx] || false : false
    );

    let title = $derived(
        isOverride
            ? ROLE_LABELS[overrideRole] || overrideRole
            : isExtended
              ? EXTENDED_COLOR_LABELS[extKey] || extKey
              : ANSI_COLOR_NAMES[idx] || ''
    );
    let subtitle = $derived(
        isOverride ? overrideApp : isExtended ? 'Extended' : `#${idx}`
    );

    let eyedropperActive = $derived(getEyedropperActive());

    let hexInput = $state('');
    let isValid = $state(true);
    let rgb = $derived(hexToRgb(currentColor));

    $effect(() => {
        hexInput = currentColor;
        isValid = true;
    });

    function applyColor(hex: string) {
        if (locked) return;
        hexInput = hex;
        isValid = true;
        if (isOverride) setAppOverride(overrideApp, overrideRole, hex);
        else if (isExtended) setExtendedColor(extKey, hex);
        else setColor(idx, hex);
    }

    function handleHexInput(value: string) {
        hexInput = value;
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
            isValid = true;
            if (!locked) {
                if (isOverride)
                    setAppOverride(overrideApp, overrideRole, value);
                else if (isExtended) setExtendedColor(extKey, value);
                else setColor(idx, value);
            }
        } else {
            isValid = false;
        }
    }

    function handleRgbChange(channel: 'r' | 'g' | 'b', value: number) {
        const c = hexToRgb(currentColor);
        c[channel] = value;
        applyColor(rgbToHex(c.r, c.g, c.b));
    }

    let hsl = $derived(hexToHsl(currentColor));

    function handleHslChange(channel: 'h' | 's' | 'l', value: number) {
        const next = {...hsl, [channel]: value};
        applyColor(hslToHex(next.h, next.s, next.l));
    }

    const HARMONY: {label: string; delta: number; title: string}[] = [
        {label: 'An−', delta: -30, title: 'Analogous −30°'},
        {label: 'Tri', delta: 120, title: 'Triad +120°'},
        {label: 'Comp', delta: 180, title: 'Complement +180°'},
        {label: 'Tri', delta: 240, title: 'Triad +240°'},
        {label: 'An+', delta: 30, title: 'Analogous +30°'},
    ];

    let harmonyColors = $derived(
        HARMONY.map(h => ({
            ...h,
            hex: hslToHex(hsl.h + h.delta, hsl.s, hsl.l),
        }))
    );

    // Debounced so slider drags don't flood the recents list with intermediate
    // hexes; only the value the user settles on is recorded.
    let recordTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        const hex = currentColor;
        if (!isValidHex(hex)) return;
        if (recordTimer) clearTimeout(recordTimer);
        recordTimer = setTimeout(() => pushRecentColor(hex), 600);
    });
    onDestroy(() => {
        if (recordTimer) clearTimeout(recordTimer);
    });

    // When editing an app override, prefer the role map's computed bg/fg so
    // the ratio reflects what the target app will actually render against.
    let contrastBg = $derived(
        (isOverride && computedVars['background']) ||
            getPalette()[0] ||
            '#000000'
    );
    let contrastFg = $derived(
        (isOverride && computedVars['foreground']) ||
            getPalette()[15] ||
            '#ffffff'
    );

    let isBgAnchor = $derived(!isExtended && !isOverride && idx === 0);
    let isFgAnchor = $derived(!isExtended && !isOverride && idx === 15);

    // Cache the current-color luminance so a slider tick doesn't gamma-decode
    // it twice (once per ratio derived).
    let currentLum = $derived(relativeLuminance(currentColor));
    const ratio = (otherHex: string) => {
        const l = relativeLuminance(otherHex);
        const [hi, lo] = currentLum > l ? [currentLum, l] : [l, currentLum];
        return (hi + 0.05) / (lo + 0.05);
    };
    let ratioBg = $derived(ratio(contrastBg));
    let ratioFg = $derived(ratio(contrastFg));

    const LEVEL_CLASSES: Record<ReturnType<typeof contrastLevel>, string> = {
        AAA: 'text-success border-success/40',
        AA: 'text-accent border-accent/40',
        'AA-L': 'text-warning border-warning/40',
        fail: 'text-destructive border-destructive/40',
    };

    let contrastPills = $derived(
        [
            {
                label: 'vs bg',
                ratio: ratioBg,
                anchor: contrastBg,
                show: !isBgAnchor,
            },
            {
                label: 'vs fg',
                ratio: ratioFg,
                anchor: contrastFg,
                show: !isFgAnchor,
            },
        ].filter(p => p.show)
    );

    function toggleLock() {
        if (!isExtended && !isOverride) setLockedColor(idx, !locked);
    }

    function handleResetOverride() {
        if (isOverride) {
            removeAppOverride(overrideApp, overrideRole);
            closeColorPicker();
        }
    }

    const RGB_CHANNELS = ['r', 'g', 'b'] as const;
    const RGB_LABELS = {r: 'R', g: 'G', b: 'B'};

    function channelGradient(channel: 'r' | 'g' | 'b'): string {
        const lo = {...rgb, [channel]: 0};
        const hi = {...rgb, [channel]: 255};
        return `linear-gradient(to right, ${rgbToHex(lo.r, lo.g, lo.b)}, ${rgbToHex(hi.r, hi.g, hi.b)})`;
    }

    const HSL_CHANNELS = ['h', 's', 'l'] as const;
    const HSL_LABELS = {h: 'H', s: 'S', l: 'L'};
    const HSL_MAX = {h: 360, s: 100, l: 100};
    const HSL_SUFFIX = {h: '°', s: '%', l: '%'};
    const HUE_RAINBOW =
        'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)';

    function hslChannelGradient(channel: 'h' | 's' | 'l'): string {
        if (channel === 'h') return HUE_RAINBOW;
        if (channel === 's') {
            return `linear-gradient(to right, ${hslToHex(hsl.h, 0, hsl.l)}, ${hslToHex(hsl.h, 100, hsl.l)})`;
        }
        // l: black → pure hue at 50% lightness → white
        return `linear-gradient(to right, #000, ${hslToHex(hsl.h, hsl.s, 50)}, #fff)`;
    }

    type OklchChannel = 'l' | 'c' | 'h';

    let oklch = $derived(hexToOklch(currentColor));

    const OKLCH_CHANNELS: readonly OklchChannel[] = ['l', 'c', 'h'] as const;
    const OKLCH_LABELS: Record<OklchChannel, string> = {l: 'L', c: 'C', h: 'H'};
    // Slider scaling: step=1 on the input element, so we map L 0..1 → 0..100
    // and C 0..0.4 → 0..40 for smooth dragging, then convert back on change.
    const OKLCH_MAX: Record<OklchChannel, number> = {l: 100, c: 40, h: 360};
    const OKLCH_FROM_SLIDER: Record<OklchChannel, number> = {
        l: 1 / 100,
        c: 1 / 100,
        h: 1,
    };

    let oklchSlider = $derived<Record<OklchChannel, number>>({
        l: oklch.l / OKLCH_FROM_SLIDER.l,
        c: oklch.c / OKLCH_FROM_SLIDER.c,
        h: oklch.h / OKLCH_FROM_SLIDER.h,
    });

    function handleOklchChange(channel: OklchChannel, sliderValue: number) {
        const next = {
            ...oklch,
            [channel]: sliderValue * OKLCH_FROM_SLIDER[channel],
        };
        applyColor(oklchToHex(next.l, next.c, next.h));
    }

    function oklchChannelGradient(channel: OklchChannel): string {
        const steps = 12;
        const stops: string[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            if (channel === 'l') stops.push(oklchToHex(t, oklch.c, oklch.h));
            else if (channel === 'c')
                stops.push(oklchToHex(oklch.l, t * 0.4, oklch.h));
            else stops.push(oklchToHex(oklch.l, oklch.c, t * 360));
        }
        return `linear-gradient(to right, ${stops.join(', ')})`;
    }

    function formatOklch(channel: OklchChannel): string {
        if (channel === 'l') return `${Math.round(oklch.l * 100)}%`;
        if (channel === 'c') return oklch.c.toFixed(2);
        return `${Math.round(oklch.h)}°`;
    }
</script>

<div class="flex h-full flex-col">
    <div
        class="border-border flex items-center justify-between border-b px-4 py-3"
    >
        <div>
            <span class="text-fg-primary text-[12px] font-medium">{title}</span>
            <span class="text-fg-dimmed ml-2 text-[10px]">{subtitle}</span>
        </div>
        <div class="flex items-center gap-2">
            {#if isOverride && overrideValue}
                <button
                    class="text-destructive/60 hover:text-destructive text-[10px] transition-colors"
                    onclick={handleResetOverride}
                >
                    Reset
                </button>
            {/if}
            <button
                class="flex h-6 w-6 items-center justify-center transition-colors {eyedropperActive
                    ? 'text-accent'
                    : 'text-fg-dimmed hover:text-fg-primary'}"
                onclick={() => setEyedropperActive(!eyedropperActive)}
                aria-label="Pick color from wallpaper"
                aria-pressed={eyedropperActive}
                title="Pick color from wallpaper"
            >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.93-1.93-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12a1 1 0 0 0 .01-1.42ZM6.92 19 5 17.08l8.06-8.06 1.92 1.92Z"
                    />
                </svg>
            </button>
            <button
                class="text-fg-dimmed hover:text-fg-primary flex h-6 w-6 items-center justify-center transition-colors"
                onclick={closeColorPicker}
                aria-label="Close color picker"
            >
                <svg
                    class="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                >
                    <path d="M18 6L6 18M6 6l12 12"></path>
                </svg>
            </button>
        </div>
    </div>

    <div class="space-y-4 p-4">
        <div class="flex gap-3">
            <label
                class="border-border relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden border"
            >
                <div
                    class="absolute inset-0"
                    style:background-color={currentColor}
                ></div>
                {#if !locked}
                    <input
                        type="color"
                        value={currentColor}
                        oninput={e => applyColor(e.currentTarget.value)}
                        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                {/if}
            </label>

            <div class="flex flex-1 flex-col justify-between">
                <div>
                    <span
                        class="text-fg-dimmed mb-1 block text-[9px] uppercase tracking-wider"
                        >Hex</span
                    >
                    <input
                        type="text"
                        class="text-fg-primary bg-bg-secondary w-full border px-2.5 py-1.5 font-mono text-[13px] outline-none
                          {isValid
                            ? 'focus:border-accent border-border'
                            : 'border-destructive'}"
                        data-color-hex-input
                        value={hexInput}
                        oninput={e => handleHexInput(e.currentTarget.value)}
                        maxlength={7}
                        spellcheck={false}
                        disabled={locked}
                    />
                </div>
                {#if !isExtended && !isOverride}
                    <div class="mt-2 flex items-center justify-between">
                        <span class="text-fg-dimmed text-[10px]">Locked</span>
                        <button
                            class="relative h-5 w-9 transition-colors duration-150
                                {locked
                                ? 'bg-accent'
                                : 'border-border bg-bg-elevated border'}"
                            onclick={toggleLock}
                            role="switch"
                            aria-checked={locked}
                            aria-label="Lock color"
                        >
                            <span
                                class="bg-fg-primary absolute left-0.5 top-0.5 h-4 w-4 transition-transform duration-150
                                    {locked
                                    ? 'translate-x-4'
                                    : 'translate-x-0'}"
                            ></span>
                        </button>
                    </div>
                {/if}
            </div>
        </div>

        {#if contrastPills.length > 0}
            <div class="space-y-1.5">
                <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                    >Contrast</span
                >
                <div class="flex gap-1.5">
                    {#each contrastPills as pill}
                        {@const level = contrastLevel(pill.ratio)}
                        <div
                            class="flex flex-1 items-center justify-between border px-2 py-1 {LEVEL_CLASSES[
                                level
                            ]}"
                            title="Contrast against {pill.anchor}"
                        >
                            <span class="text-fg-dimmed text-[9px]"
                                >{pill.label}</span
                            >
                            <span class="font-mono text-[10px] tabular-nums"
                                >{pill.ratio.toFixed(1)}:1</span
                            >
                            <span class="text-[9px] font-semibold">{level}</span
                            >
                        </div>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="space-y-1.5">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >Harmony</span
            >
            <div class="flex gap-1">
                {#each harmonyColors as h}
                    <button
                        type="button"
                        class="border-border hover:border-border-focus flex flex-1 flex-col items-stretch border transition-colors disabled:opacity-40"
                        onclick={() => applyColor(h.hex)}
                        disabled={locked}
                        title="{h.title} · {h.hex}"
                    >
                        <div
                            class="h-6 w-full"
                            style:background-color={h.hex}
                        ></div>
                        <span
                            class="text-fg-dimmed py-0.5 text-center text-[8px] tabular-nums leading-none"
                            >{h.label}</span
                        >
                    </button>
                {/each}
            </div>
        </div>

        <div class="space-y-2">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >RGB Channels</span
            >
            {#each RGB_CHANNELS as channel}
                <div class="flex items-center gap-2">
                    <span class="text-fg-dimmed w-3 font-mono text-[10px]"
                        >{RGB_LABELS[channel]}</span
                    >
                    <div
                        class="relative h-3 flex-1"
                        style="background: {channelGradient(
                            channel
                        )}; border: 1px solid var(--color-border);"
                    >
                        <input
                            type="range"
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            min="0"
                            max="255"
                            step="1"
                            value={rgb[channel]}
                            oninput={e =>
                                handleRgbChange(
                                    channel,
                                    parseInt(e.currentTarget.value)
                                )}
                            disabled={locked}
                        />
                        <div
                            class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-sm"
                            style:left="{(rgb[channel] / 255) * 100}%"
                        ></div>
                    </div>
                    <span
                        class="text-fg-dimmed w-7 text-right font-mono text-[10px]"
                        >{rgb[channel]}</span
                    >
                </div>
            {/each}
        </div>

        <div class="space-y-2">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >HSL Channels</span
            >
            {#each HSL_CHANNELS as channel}
                <div class="flex items-center gap-2">
                    <span class="text-fg-dimmed w-3 font-mono text-[10px]"
                        >{HSL_LABELS[channel]}</span
                    >
                    <div
                        class="relative h-3 flex-1"
                        style="background: {hslChannelGradient(
                            channel
                        )}; border: 1px solid var(--color-border);"
                    >
                        <input
                            type="range"
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            min="0"
                            max={HSL_MAX[channel]}
                            step="1"
                            value={hsl[channel]}
                            oninput={e =>
                                handleHslChange(
                                    channel,
                                    parseFloat(e.currentTarget.value)
                                )}
                            disabled={locked}
                        />
                        <div
                            class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-sm"
                            style:left="{(hsl[channel] / HSL_MAX[channel]) *
                                100}%"
                        ></div>
                    </div>
                    <span
                        class="text-fg-dimmed w-7 text-right font-mono text-[10px] tabular-nums"
                        >{Math.round(hsl[channel])}{HSL_SUFFIX[channel]}</span
                    >
                </div>
            {/each}
        </div>

        <div class="space-y-2">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >OKLCH Channels</span
            >
            {#each OKLCH_CHANNELS as channel}
                <div class="flex items-center gap-2">
                    <span class="text-fg-dimmed w-3 font-mono text-[10px]"
                        >{OKLCH_LABELS[channel]}</span
                    >
                    <div
                        class="relative h-3 flex-1"
                        style="background: {oklchChannelGradient(
                            channel
                        )}; border: 1px solid var(--color-border);"
                    >
                        <input
                            type="range"
                            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            min="0"
                            max={OKLCH_MAX[channel]}
                            step="1"
                            value={oklchSlider[channel]}
                            oninput={e =>
                                handleOklchChange(
                                    channel,
                                    parseFloat(e.currentTarget.value)
                                )}
                            disabled={locked}
                        />
                        <div
                            class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white shadow-sm"
                            style:left="{(oklchSlider[channel] /
                                OKLCH_MAX[channel]) *
                                100}%"
                        ></div>
                    </div>
                    <span
                        class="text-fg-dimmed w-10 text-right font-mono text-[10px] tabular-nums"
                        >{formatOklch(channel)}</span
                    >
                </div>
            {/each}
        </div>

        {#if getRecentColors().length > 0}
            <div class="space-y-1.5">
                <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                    >Recent</span
                >
                <div class="grid grid-cols-12 gap-1">
                    {#each getRecentColors() as hex}
                        <button
                            type="button"
                            class="border-border hover:border-border-focus aspect-square border transition-colors disabled:opacity-40"
                            style:background-color={hex}
                            onclick={() => applyColor(hex)}
                            disabled={locked}
                            title={hex}
                        ></button>
                    {/each}
                </div>
            </div>
        {/if}

        <div>
            <span
                class="text-fg-dimmed mb-2 block text-[9px] uppercase tracking-wider"
                >Shades & Tints</span
            >
            <ShadeGrid baseColor={currentColor} onselect={c => applyColor(c)} />
        </div>
    </div>
</div>
