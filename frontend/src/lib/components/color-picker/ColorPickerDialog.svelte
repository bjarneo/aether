<script lang="ts">
    import {
        getColorPickerIndex,
        getColorPickerExtKey,
        getColorPickerOverrideApp,
        getColorPickerOverrideRole,
        closeColorPicker,
        getEyedropperActive,
        setEyedropperActive,
        getColorPickerModel,
        setColorPickerModel,
        COLOR_MODELS,
        type ColorModel,
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
        contrastRatio,
        contrastLevel,
        copyColor,
    } from '$lib/utils/color';
    import {
        getRecentColors,
        pushRecentColor,
    } from '$lib/stores/recentColors.svelte';
    import ShadeGrid from './ShadeGrid.svelte';
    import ChannelSlider from './ChannelSlider.svelte';
    import LockIcon from '$lib/components/shared/LockIcon.svelte';
    import CloseIcon from '$lib/components/shared/CloseIcon.svelte';
    import {clamp} from '$lib/utils/math';

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

    // Cache the import promise so each effect tick reuses the same module
    // instance instead of allocating a new resolution chain.
    const appModule = import('../../../../wailsjs/go/main/App');

    // Token guards against stale ComputeVariables resolves clobbering newer
    // results when the user flips between overrides quickly.
    let computeToken = 0;
    $effect(() => {
        if (!isOverride) return;
        const token = ++computeToken;
        appModule
            .then(({ComputeVariables}) =>
                ComputeVariables(getPalette(), getExtendedColors(), false)
            )
            .then(result => {
                if (token === computeToken) computedVars = result || {};
            })
            .catch(() => {});
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

    let isAnsi = $derived(!isExtended && !isOverride);
    let locked = $derived(isAnsi ? getLockedColors()[idx] || false : false);

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
    let isValid = $derived(isValidHex(hexInput));
    let rgb = $derived(hexToRgb(currentColor));

    $effect(() => {
        hexInput = currentColor;
    });

    function applyColor(hex: string) {
        if (locked) return;
        hexInput = hex;
        if (isOverride) setAppOverride(overrideApp, overrideRole, hex);
        else if (isExtended) setExtendedColor(extKey, hex);
        else setColor(idx, hex);
    }

    function handleHexInput(value: string) {
        hexInput = value;
        if (!locked && isValidHex(value)) {
            if (isOverride) setAppOverride(overrideApp, overrideRole, value);
            else if (isExtended) setExtendedColor(extKey, value);
            else setColor(idx, value);
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
        {label: 'Tri+', delta: 120, title: 'Triad +120°'},
        {label: 'Comp', delta: 180, title: 'Complement +180°'},
        {label: 'Tri−', delta: 240, title: 'Triad +240° (−120°)'},
        {label: 'An+', delta: 30, title: 'Analogous +30°'},
    ];

    const MODEL_LABELS: Record<ColorModel, string> = {
        rgb: 'RGB',
        hsl: 'HSL',
        oklch: 'OKLCH',
    };
    let activeModel = $derived(getColorPickerModel());

    function parseEditedNumber(raw: string): number | null {
        const n = parseFloat(raw.replace(/[°%]/g, '').trim());
        return Number.isFinite(n) ? n : null;
    }

    function makeCommitHandler<C extends string>(
        channel: C,
        handle: (c: C, value: number) => void,
        max: number,
        transform: (n: number) => number = n => n
    ): (raw: string) => void {
        return raw => {
            const n = parseEditedNumber(raw);
            if (n === null) return;
            handle(channel, clamp(transform(n), 0, max));
        };
    }

    let harmonyColors = $derived(
        HARMONY.map(h => ({
            ...h,
            hex: hslToHex(hsl.h + h.delta, hsl.s, hsl.l),
        }))
    );

    // Debounce so a slider drag records only the value the user settles on,
    // not every intermediate hex produced during the gesture.
    const RECENT_RECORD_DELAY_MS = 600;
    let recordTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        const hex = currentColor;
        if (!isValidHex(hex)) return;
        if (recordTimer) clearTimeout(recordTimer);
        recordTimer = setTimeout(
            () => pushRecentColor(hex),
            RECENT_RECORD_DELAY_MS
        );
    });
    onDestroy(() => {
        if (recordTimer) clearTimeout(recordTimer);
    });

    // For overrides, prefer the role map's computed bg/fg so the ratio
    // reflects what the target app will actually render against. ANSI
    // palette anchors fall back to slots 0/15 (black/white by convention).
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

    let ratioBg = $derived(contrastRatio(currentColor, contrastBg));
    let ratioFg = $derived(contrastRatio(currentColor, contrastFg));

    const LEVEL_TEXT: Record<ReturnType<typeof contrastLevel>, string> = {
        AAA: 'text-success',
        AA: 'text-accent',
        'AA-L': 'text-warning',
        fail: 'text-destructive',
    };

    let contrastPills = $derived(
        [
            {
                label: 'bg',
                ratio: ratioBg,
                anchor: contrastBg,
                show: !(isAnsi && idx === 0),
            },
            {
                label: 'fg',
                ratio: ratioFg,
                anchor: contrastFg,
                show: !(isAnsi && idx === 15),
            },
        ].filter(p => p.show)
    );

    function toggleLock() {
        if (isAnsi) setLockedColor(idx, !locked);
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
        return `linear-gradient(to right, #000, ${hslToHex(hsl.h, hsl.s, 50)}, #fff)`;
    }

    type OklchChannel = 'l' | 'c' | 'h';

    let oklch = $derived(hexToOklch(currentColor));

    const OKLCH_CHANNELS: readonly OklchChannel[] = ['l', 'c', 'h'] as const;
    const OKLCH_LABELS: Record<OklchChannel, string> = {l: 'L', c: 'C', h: 'H'};
    // Slider range stays integer (step=1) for smooth dragging: L 0..1 maps
    // to 0..100, C 0..0.4 maps to 0..40, H stays 0..360. Convert back via
    // OKLCH_FROM_SLIDER on each change.
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

    let recents = $derived(getRecentColors());
</script>

<div class="flex h-full flex-col">
    <header
        class="border-border flex items-center justify-between gap-2 border-b px-4 py-2.5"
    >
        <div class="min-w-0">
            <div class="text-fg-primary truncate text-[12px] font-medium">
                {title}
            </div>
            <div class="text-fg-dimmed truncate text-[10px]">
                {subtitle}
            </div>
        </div>
        <div class="flex shrink-0 items-center gap-0.5">
            <button
                class="flex h-7 w-7 items-center justify-center transition-colors {eyedropperActive
                    ? 'text-accent bg-accent-muted'
                    : 'text-fg-dimmed hover:text-fg-primary hover:bg-bg-hover'}"
                onclick={() => setEyedropperActive(!eyedropperActive)}
                aria-label="Pick color from wallpaper"
                aria-pressed={eyedropperActive}
                title="Pick from wallpaper"
            >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path
                        d="M20.71 5.63l-2.34-2.34a1 1 0 0 0-1.41 0l-3.12 3.12-1.93-1.93-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.92-1.92 3.12-3.12a1 1 0 0 0 .01-1.42ZM6.92 19 5 17.08l8.06-8.06 1.92 1.92Z"
                    />
                </svg>
            </button>
            {#if isAnsi}
                <button
                    class="flex h-7 w-7 items-center justify-center transition-colors {locked
                        ? 'text-accent bg-accent-muted'
                        : 'text-fg-dimmed hover:text-fg-primary hover:bg-bg-hover'}"
                    onclick={toggleLock}
                    role="switch"
                    aria-checked={locked}
                    title={locked ? 'Unlock color' : 'Lock color'}
                >
                    <LockIcon {locked} size="h-4 w-4" />
                </button>
            {/if}
            {#if isOverride && overrideValue}
                <button
                    class="text-destructive/70 hover:text-destructive hover:bg-destructive/10 flex h-7 items-center justify-center px-2 text-[10px] uppercase tracking-wider transition-colors"
                    onclick={handleResetOverride}
                    title="Reset override to computed value"
                >
                    Reset
                </button>
            {/if}
            <button
                class="text-fg-dimmed hover:text-fg-primary hover:bg-bg-hover flex h-7 w-7 items-center justify-center transition-colors"
                onclick={closeColorPicker}
                aria-label="Close color picker"
                title="Close"
            >
                <CloseIcon />
            </button>
        </div>
    </header>

    <div class="flex-1 space-y-4 overflow-y-auto p-4">
        <div class="flex gap-3">
            <label
                class="border-border relative h-16 w-16 shrink-0 overflow-hidden border {locked
                    ? 'cursor-not-allowed'
                    : 'cursor-pointer'}"
            >
                <div
                    class="absolute inset-0"
                    style:background-color={currentColor}
                ></div>
                {#if locked}
                    <div
                        class="absolute inset-0 flex items-center justify-center bg-black/45 text-white"
                    >
                        <LockIcon locked={true} size="h-5 w-5" />
                    </div>
                {:else}
                    <input
                        type="color"
                        value={currentColor}
                        oninput={e => applyColor(e.currentTarget.value)}
                        class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        aria-label="Native color picker"
                    />
                {/if}
            </label>

            <div class="flex min-w-0 flex-1 flex-col justify-between gap-1.5">
                <div class="relative">
                    <input
                        type="text"
                        class="text-fg-primary bg-bg-secondary w-full border py-1.5 pl-2.5 pr-8 font-mono text-[13px] outline-none disabled:cursor-not-allowed disabled:opacity-50
                          {isValid
                            ? 'focus:border-accent border-border'
                            : 'border-destructive'}"
                        data-color-hex-input
                        value={hexInput}
                        oninput={e => handleHexInput(e.currentTarget.value)}
                        maxlength={7}
                        spellcheck={false}
                        disabled={locked}
                        aria-label="Hex value"
                        aria-invalid={!isValid}
                        aria-describedby={isValid
                            ? undefined
                            : 'hex-input-error'}
                    />
                    <button
                        type="button"
                        class="text-fg-dimmed hover:text-fg-primary absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center transition-colors"
                        onclick={() => copyColor(currentColor)}
                        title="Copy hex"
                        aria-label="Copy hex"
                    >
                        <svg
                            class="h-3.5 w-3.5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <rect x="9" y="9" width="13" height="13"></rect>
                            <path
                                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                            ></path>
                        </svg>
                    </button>
                </div>

                {#if !isValid}
                    <p
                        id="hex-input-error"
                        class="text-destructive text-[10px]"
                    >
                        Enter a 6-digit hex like #1a2b3c
                    </p>
                {:else if contrastPills.length > 0}
                    <div
                        class="text-fg-dimmed flex items-center gap-2 text-[10px] tabular-nums"
                    >
                        {#each contrastPills as pill}
                            {@const level = contrastLevel(pill.ratio)}
                            <span
                                class="flex items-baseline gap-1"
                                title="Contrast against {pill.anchor}"
                            >
                                <span class="font-mono"
                                    >{pill.ratio.toFixed(1)}</span
                                >
                                <span class="font-semibold {LEVEL_TEXT[level]}"
                                    >{level}</span
                                >
                                <span>vs {pill.label}</span>
                            </span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <section class="space-y-2">
            <div class="flex items-center justify-between">
                <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                    >Channels</span
                >
                <div class="flex items-center gap-px">
                    {#each COLOR_MODELS as id}
                        <button
                            type="button"
                            class="border px-1.5 py-0.5 text-[9px] uppercase tracking-wider transition-colors
                            {activeModel === id
                                ? 'text-accent border-accent bg-accent-muted'
                                : 'text-fg-dimmed border-border hover:text-fg-secondary'}"
                            onclick={() => setColorPickerModel(id)}
                            aria-pressed={activeModel === id}
                            >{MODEL_LABELS[id]}</button
                        >
                    {/each}
                </div>
            </div>

            {#if activeModel === 'rgb'}
                {#each RGB_CHANNELS as channel}
                    <ChannelSlider
                        label={RGB_LABELS[channel]}
                        value={rgb[channel]}
                        max={255}
                        display={String(rgb[channel])}
                        gradient={channelGradient(channel)}
                        disabled={locked}
                        onchange={v => handleRgbChange(channel, Math.round(v))}
                        oncommit={makeCommitHandler(
                            channel,
                            handleRgbChange,
                            255,
                            Math.round
                        )}
                    />
                {/each}
            {:else if activeModel === 'hsl'}
                {#each HSL_CHANNELS as channel}
                    <ChannelSlider
                        label={HSL_LABELS[channel]}
                        value={hsl[channel]}
                        max={HSL_MAX[channel]}
                        display={`${Math.round(hsl[channel])}${HSL_SUFFIX[channel]}`}
                        gradient={hslChannelGradient(channel)}
                        disabled={locked}
                        onchange={v => handleHslChange(channel, v)}
                        oncommit={makeCommitHandler(
                            channel,
                            handleHslChange,
                            HSL_MAX[channel]
                        )}
                    />
                {/each}
            {:else}
                {#each OKLCH_CHANNELS as channel}
                    <ChannelSlider
                        label={OKLCH_LABELS[channel]}
                        value={oklchSlider[channel]}
                        max={OKLCH_MAX[channel]}
                        display={formatOklch(channel)}
                        gradient={oklchChannelGradient(channel)}
                        disabled={locked}
                        onchange={v => handleOklchChange(channel, v)}
                        oncommit={makeCommitHandler(
                            channel,
                            handleOklchChange,
                            OKLCH_MAX[channel],
                            channel === 'c' ? n => n * 100 : undefined
                        )}
                    />
                {/each}
            {/if}
        </section>

        <section class="space-y-1.5">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >Harmony</span
            >
            <div class="grid grid-cols-5 gap-1">
                {#each harmonyColors as h}
                    <button
                        type="button"
                        class="border-border hover:border-border-focus flex flex-col items-stretch border transition-colors disabled:opacity-40"
                        onclick={() => applyColor(h.hex)}
                        disabled={locked}
                        title="{h.title} · {h.hex}"
                    >
                        <div
                            class="h-7 w-full"
                            style:background-color={h.hex}
                        ></div>
                        <span
                            class="text-fg-dimmed py-0.5 text-center text-[9px] tabular-nums leading-none"
                            >{h.label}</span
                        >
                    </button>
                {/each}
            </div>
        </section>

        <section class="space-y-1.5">
            <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                >Tones</span
            >
            <ShadeGrid baseColor={currentColor} onselect={c => applyColor(c)} />
        </section>

        {#if recents.length > 0}
            <section class="space-y-1.5">
                <span class="text-fg-dimmed text-[9px] uppercase tracking-wider"
                    >Recent</span
                >
                <div class="grid grid-cols-12 gap-1">
                    {#each recents as hex}
                        <button
                            type="button"
                            class="border-border hover:border-border-focus aspect-square border transition-colors disabled:opacity-40"
                            style:background-color={hex}
                            onclick={() => applyColor(hex)}
                            disabled={locked}
                            title={hex}
                            aria-label="Apply {hex}"
                        ></button>
                    {/each}
                </div>
            </section>
        {/if}
    </div>
</div>
