<script lang="ts">
    import {hexToHsl, hslToHex} from '$lib/utils/color';

    let {
        baseColor,
        onselect,
    }: {
        baseColor: string;
        onselect: (color: string) => void;
    } = $props();

    let grid = $derived(generateGrid(baseColor));

    function generateGrid(hex: string) {
        const {h, s, l} = hexToHsl(hex);

        // Row 1: Lightness variations (dark to light) at current saturation
        const lightnessRow = Array.from({length: 10}, (_, i) =>
            hslToHex(h, s, 5 + i * 10)
        );

        // Row 2: Saturation variations at current lightness
        const satRow = Array.from({length: 10}, (_, i) =>
            hslToHex(h, 5 + i * 10, l)
        );

        // Row 3: Hue rotation at current sat/lightness
        const hueRow = Array.from({length: 10}, (_, i) =>
            hslToHex(i * 36, s, l)
        );

        // Row 4: Warm/cool tints (hue shifted slightly, varied lightness)
        const tintRow = Array.from({length: 10}, (_, i) => {
            const hShift = h + (i - 5) * 8;
            const lShift = l + (i - 5) * 3;
            return hslToHex(
                (hShift + 360) % 360,
                s,
                Math.max(5, Math.min(95, lShift))
            );
        });

        return [lightnessRow, satRow, hueRow, tintRow];
    }

    const rowLabels = ['Lightness', 'Saturation', 'Hue', 'Analogous'];
</script>

<div class="space-y-2">
    {#each grid as row, ri}
        <div>
            <span
                class="text-fg-dimmed mb-0.5 block text-[8px] uppercase tracking-wider"
                >{rowLabels[ri]}</span
            >
            <div class="flex gap-px">
                {#each row as shade}
                    <button
                        class="h-5 flex-1 cursor-pointer border border-transparent transition-all duration-100 hover:z-10 hover:scale-y-150 hover:border-white/30"
                        style:background-color={shade}
                        onclick={() => onselect(shade)}
                        title={shade}
                    ></button>
                {/each}
            </div>
        </div>
    {/each}
</div>
