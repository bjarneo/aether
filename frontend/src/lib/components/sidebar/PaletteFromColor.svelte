<script lang="ts">
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {setPalette} from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    let baseColor = $state('#89b4fa');
    let expanded = $state(false);

    async function generate() {
        try {
            const {GeneratePaletteFromColor} = await import(
                '../../../../wailsjs/go/main/App'
            );
            const result = await GeneratePaletteFromColor(baseColor);
            setPalette(result);
            showToast('Generated palette from color');
        } catch {
            showToast('Failed to generate palette');
        }
    }
</script>

<ExpandableSection title="Palette from Color" bind:expanded>
    <div class="flex items-center gap-2">
        <input
            type="color"
            bind:value={baseColor}
            class="h-6 w-8 cursor-pointer border-none bg-transparent"
        />
        <span class="text-fg-dimmed font-mono text-xs">{baseColor}</span>
        <button
            class="bg-bg-surface border-border text-fg-primary hover:border-accent ml-auto border px-2 py-1 text-[10px]"
            onclick={generate}
        >
            Generate
        </button>
    </div>
</ExpandableSection>
