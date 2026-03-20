<script lang="ts">
    import ExpandableSection from '$lib/components/shared/ExpandableSection.svelte';
    import {setPalette} from '$lib/stores/theme.svelte';
    import {showToast} from '$lib/stores/ui.svelte';
    import {PRESET_THEMES} from '$lib/constants/colors';

    let expanded = $state(false);
    const presetNames = Object.keys(PRESET_THEMES);

    function applyPreset(name: string) {
        setPalette(PRESET_THEMES[name]);
        showToast(`Applied ${name} preset`);
    }
</script>

<ExpandableSection title="Presets" bind:expanded>
    <div class="grid grid-cols-2 gap-1.5">
        {#each presetNames as name}
            <button
                class="bg-bg-surface border-border hover:border-accent flex flex-col gap-1 border p-1.5 text-left transition-colors"
                onclick={() => applyPreset(name)}
            >
                <span class="text-fg-secondary truncate text-[10px]"
                    >{name}</span
                >
                <div class="flex h-3 w-full">
                    {#each PRESET_THEMES[name].slice(0, 8) as color}
                        <div
                            class="flex-1"
                            style:background-color={color}
                        ></div>
                    {/each}
                </div>
            </button>
        {/each}
    </div>
</ExpandableSection>
