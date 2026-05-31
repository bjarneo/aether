<script lang="ts">
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {setPalette} from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';

    let startColor = $state('#1e1e2e');
    let endColor = $state('#89b4fa');
    let preview = $state<string[]>([]);
    let expanded = $state(false);

    async function generatePreview() {
        try {
            const {GenerateGradient} = await import(
                '../../../../wailsjs/go/main/App'
            );
            preview = await GenerateGradient(startColor, endColor);
        } catch {
            preview = Array.from({length: 16}, (_, i) => {
                const r = i / 15;
                return `hsl(${220 + r * 40}, 50%, ${10 + r * 80}%)`;
            });
        }
    }

    function applyGradient() {
        if (preview.length === 16) {
            setPalette(preview);
            showToast('Applied gradient palette');
        }
    }
</script>

<ExpandableSection title="Gradient Generator" bind:expanded>
    <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
            <input
                type="color"
                bind:value={startColor}
                class="h-6 w-8 cursor-pointer border-none bg-transparent"
                title="Start color"
                aria-label="Gradient start color"
            />
            <span class="text-fg-dimmed text-[10px]">&rarr;</span>
            <input
                type="color"
                bind:value={endColor}
                class="h-6 w-8 cursor-pointer border-none bg-transparent"
                title="End color"
                aria-label="Gradient end color"
            />
            <button
                class="bg-bg-surface border-border text-fg-primary hover:border-accent ml-auto border px-2 py-1 text-[10px] transition-colors"
                onclick={generatePreview}>Preview</button
            >
        </div>

        {#if preview.length > 0}
            <div class="flex h-5">
                {#each preview as color}
                    <div class="flex-1" style:background-color={color}></div>
                {/each}
            </div>
            <button
                class="bg-bg-surface border-border text-fg-primary hover:border-accent border px-2 py-1 text-center text-[10px] transition-colors"
                onclick={applyGradient}>Apply Gradient</button
            >
        {/if}
    </div>
</ExpandableSection>
