<script lang="ts">
    import {
        getColorPickerIndex,
        getColorPickerExtKey,
        getColorPickerOverrideApp,
        getColorPickerOverrideRole,
        closeColorPicker,
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
    import {hexToRgb, rgbToHex} from '$lib/utils/color';
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

        <div>
            <span
                class="text-fg-dimmed mb-2 block text-[9px] uppercase tracking-wider"
                >Shades & Tints</span
            >
            <ShadeGrid baseColor={currentColor} onselect={c => applyColor(c)} />
        </div>
    </div>
</div>
