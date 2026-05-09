<script lang="ts">
    import {hexToHsl, hslToHex} from '$lib/utils/color';

    let {
        baseColor,
        onselect,
    }: {
        baseColor: string;
        onselect: (color: string) => void;
    } = $props();

    const COLS = 10;
    const L_MIN = 10;
    const L_MAX = 95;
    const SAT_LEVELS = [100, 75, 50, 25] as const;
    const HUE_STEPS = 12;

    let hsl = $derived(hexToHsl(baseColor));

    // Split deriveds so adjusting only saturation/lightness doesn't re-run
    // the 40-cell tone grid (depends only on hue), and vice versa.
    let hue = $derived(hsl.h);
    let toneGrid = $derived(
        SAT_LEVELS.map(sat =>
            Array.from({length: COLS}, (_, i) =>
                hslToHex(hue, sat, L_MIN + (i * (L_MAX - L_MIN)) / (COLS - 1))
            )
        )
    );

    let hueStrip = $derived(
        Array.from({length: HUE_STEPS}, (_, i) =>
            hslToHex((i * 360) / HUE_STEPS, hsl.s, hsl.l)
        )
    );
</script>

<div class="space-y-1.5">
    <div class="flex flex-col gap-px">
        {#each toneGrid as row}
            <div class="flex gap-px">
                {#each row as shade}
                    <button
                        type="button"
                        class="h-5 flex-1 cursor-pointer border border-transparent transition-all duration-100 hover:z-10 hover:scale-y-150 hover:border-white/40"
                        style:background-color={shade}
                        onclick={() => onselect(shade)}
                        title={shade}
                        aria-label="Apply {shade}"
                    ></button>
                {/each}
            </div>
        {/each}
    </div>

    <div class="flex gap-px">
        {#each hueStrip as hue}
            <button
                type="button"
                class="h-5 flex-1 cursor-pointer border border-transparent transition-all duration-100 hover:z-10 hover:scale-y-150 hover:border-white/40"
                style:background-color={hue}
                onclick={() => onselect(hue)}
                title="Hue · {hue}"
                aria-label="Apply hue {hue}"
            ></button>
        {/each}
    </div>
</div>
