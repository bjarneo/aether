<script lang="ts">
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {getPalette} from '$lib/stores/theme.svelte';

    let expanded = $state(false);
    let ratio = $state(0);
    let level = $state('');

    $effect(() => {
        const p = getPalette();
        if (p[0] && p[7]) checkContrast(p[0], p[7]);
    });

    async function checkContrast(bg: string, fg: string) {
        try {
            const {ContrastRatio} = await import(
                '../../../../wailsjs/go/main/App'
            );
            ratio = await ContrastRatio(bg, fg);
            if (ratio >= 7) level = 'AAA';
            else if (ratio >= 4.5) level = 'AA';
            else level = 'Fail';
        } catch {
            /* ignore */
        }
    }

    function levelClass(lvl: string): string {
        if (lvl === 'AAA') return 'text-success';
        if (lvl === 'AA') return 'text-warning';
        return 'text-destructive';
    }
</script>

<ExpandableSection title="Accessibility" bind:expanded>
    <div class="bg-bg-surface border-border border p-2">
        <div class="mb-1 flex items-center justify-between">
            <span class="text-fg-dimmed text-[10px]">Contrast Ratio</span>
            <span class="font-mono text-[10px] {levelClass(level)}"
                >{ratio.toFixed(1)}:1</span
            >
        </div>
        <div class="flex items-center justify-between">
            <span class="text-fg-dimmed text-[10px]">WCAG Level</span>
            <span class="text-[10px] font-medium {levelClass(level)}"
                >{level || '—'}</span
            >
        </div>
        <div class="mt-2 flex gap-1">
            <div
                class="flex h-6 flex-1 items-center justify-center text-[10px]"
                style:background-color={getPalette()[0]}
                style:color={getPalette()[7]}
            >
                Sample
            </div>
            <div
                class="flex h-6 flex-1 items-center justify-center text-[10px]"
                style:background-color={getPalette()[7]}
                style:color={getPalette()[0]}
            >
                Sample
            </div>
        </div>
    </div>
</ExpandableSection>
